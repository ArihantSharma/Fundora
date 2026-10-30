"""
Fundora backend — FastAPI + SQLite.

Run:
  cd backend && uvicorn main:app --reload
Docs:
  http://localhost:8000/docs
"""

import os
import secrets
import hashlib
from datetime import date, datetime, timezone, timedelta
from typing import Optional

import bcrypt
from fastapi import FastAPI, Depends, HTTPException, Cookie, Response, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator
from sqlalchemy import (
    Column, Integer, Float, String, Text, ForeignKey, JSON, Date, DateTime, Boolean,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session
from sqlalchemy import create_engine


# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fundora.db")

# Used to sign nothing (we use DB-backed sessions, not JWTs), but kept as a
# secret for the session token so it cannot be guessed. Change this in prod.
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production-please")

# Where the browser-facing frontend lives (for CORS). In Docker this is still
# localhost because the browser is on the host machine.
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

SESSION_DAYS = 7        # sessions expire after 7 days
SESSION_COOKIE = "fundora_session"


# ─────────────────────────────────────────────────────────────────────────────
# Database setup
# ─────────────────────────────────────────────────────────────────────────────

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True)
    name          = Column(String, nullable=False)
    email         = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=True)   # NULL only for seeded demo users
    role          = Column(String, nullable=False, default="Investor")
    created_at    = Column(DateTime, default=datetime.now)
    investments   = relationship("Investment", back_populates="investor")
    votes         = relationship("Vote", back_populates="user")
    sessions      = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    """Server-side session. Token sent to browser as an HttpOnly cookie."""
    __tablename__ = "user_sessions"
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    # We store the SHA-256 hash of the raw token (never the raw token itself).
    token_hash = Column(String, nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    user       = relationship("User", back_populates="sessions")


class Startup(Base):
    __tablename__ = "startups"
    id               = Column(Integer, primary_key=True)
    name             = Column(String, nullable=False)
    description      = Column(Text, default="")
    industry         = Column(String, default="Other")
    founder_id       = Column(Integer, ForeignKey("users.id"), nullable=True)
    founder_name     = Column(String, nullable=True)
    team             = Column(JSON, default=list)
    funding_required = Column(Float, nullable=False, default=0)
    status           = Column(String, default="Pending")
    pitch_deck       = Column(String, nullable=True)
    tags             = Column(JSON, default=list)
    submitted_date   = Column(Date, nullable=True)
    created_at       = Column(DateTime, default=datetime.now)
    funding_round = relationship("FundingRound", uselist=False, back_populates="startup",
                                 cascade="all, delete-orphan")
    milestones    = relationship("Milestone", back_populates="startup", cascade="all, delete-orphan")
    proposals     = relationship("Proposal", back_populates="startup")


class FundingRound(Base):
    __tablename__ = "funding_rounds"
    id               = Column(Integer, primary_key=True)
    startup_id       = Column(Integer, ForeignKey("startups.id"), nullable=False)
    target_amount    = Column(Float, nullable=False, default=0)
    equity_offered   = Column(Float, default=10.0)
    status           = Column(String, default="Open")
    contract_address = Column(String, nullable=True)
    startup          = relationship("Startup", back_populates="funding_round")
    investments      = relationship("Investment", back_populates="round", cascade="all, delete-orphan")


class Investment(Base):
    __tablename__ = "investments"
    id             = Column(Integer, primary_key=True)
    round_id       = Column(Integer, ForeignKey("funding_rounds.id"), nullable=False)
    investor_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount         = Column(Float, nullable=False)
    currency       = Column(String, nullable=False, default="INR")  # "INR" or "ETH"
    tx_hash        = Column(String, nullable=True)
    wallet_address = Column(String, nullable=True)
    created_at     = Column(DateTime, default=datetime.now)
    round          = relationship("FundingRound", back_populates="investments")
    investor       = relationship("User", back_populates="investments")


class Milestone(Base):
    __tablename__ = "milestones"
    id               = Column(Integer, primary_key=True)
    startup_id       = Column(Integer, ForeignKey("startups.id"), nullable=False)
    title            = Column(String, nullable=False)
    description      = Column(Text, default="")
    amount           = Column(Float, nullable=False, default=0)
    status           = Column(String, default="Locked")
    order            = Column(Integer, default=0)
    completed_at     = Column(Date, nullable=True)
    release_tx_hash  = Column(String, nullable=True)
    milestone_index  = Column(Integer, nullable=True)
    created_at       = Column(DateTime, default=datetime.now)
    startup          = relationship("Startup", back_populates="milestones")
    evidences        = relationship("MilestoneEvidence", back_populates="milestone",
                                    cascade="all, delete-orphan",
                                    order_by="MilestoneEvidence.submitted_at.desc()")


class MilestoneEvidence(Base):
    __tablename__ = "milestone_evidence"
    id           = Column(Integer, primary_key=True)
    milestone_id = Column(Integer, ForeignKey("milestones.id"), nullable=False)
    file_name    = Column(String, nullable=False)
    file_path    = Column(String, nullable=True)   # server-side path if file was actually uploaded
    notes        = Column(Text, default="")
    status       = Column(String, default="Pending")
    submitted_at = Column(DateTime, default=datetime.now)
    milestone    = relationship("Milestone", back_populates="evidences")


class Proposal(Base):
    __tablename__ = "proposals"
    id                  = Column(Integer, primary_key=True)
    startup_id          = Column(Integer, ForeignKey("startups.id"), nullable=False)
    type                = Column(String, nullable=False)
    title               = Column(String, nullable=False)
    description         = Column(Text, default="")
    milestone_id        = Column(Integer, nullable=True)
    milestone_title     = Column(String, nullable=True)
    milestone_amount    = Column(Float, nullable=True)
    evidence            = Column(String, nullable=True)
    yes_votes           = Column(Integer, default=0)
    no_votes            = Column(Integer, default=0)
    required_percentage = Column(Integer, default=60)
    required_quorum     = Column(Integer, default=1)  # minimum eligible votes before deadline
    voting_deadline     = Column(DateTime, nullable=True)  # 48h after evidence submission
    status              = Column(String, default="Pending")
    submitted_date      = Column(Date, nullable=True)
    created_at          = Column(DateTime, default=datetime.now)
    startup = relationship("Startup", back_populates="proposals")
    votes   = relationship("Vote", back_populates="proposal", cascade="all, delete-orphan")


class Vote(Base):
    __tablename__ = "votes"
    id          = Column(Integer, primary_key=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    vote        = Column(String, nullable=False)
    created_at  = Column(DateTime, default=datetime.now)
    proposal    = relationship("Proposal", back_populates="votes")
    user        = relationship("User", back_populates="votes")


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name:     str
    email:    str
    password: str
    role:     str = "Investor"

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        import re
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$', v):
            raise ValueError("Invalid email address format.")
        return v.lower().strip()


class LoginRequest(BaseModel):
    email:    str
    password: str


class StartupCreate(BaseModel):
    name:             str
    description:      str
    industry:         str = "Other"
    team:             list = []
    fundingRequired:  float
    pitchDeck:        Optional[str] = None
    tags:             list = []
    milestones:       list = []   # [{title, description, amount}, ...]


class InvestmentCreate(BaseModel):
    amount:        float
    txHash:        Optional[str] = None
    walletAddress: Optional[str] = None


class EvidenceCreate(BaseModel):
    fileName: str
    notes:    str = ""


class VoteCreate(BaseModel):
    vote: str   # "yes" or "no"


class BlockchainRegisterPayload(BaseModel):
    startupId:       int
    contractAddress: str
    txHash:          str


class BlockchainInvestPayload(BaseModel):
    startupId:     int
    txHash:        str
    walletAddress: str
    amountEth:     float


class BlockchainReleasePayload(BaseModel):
    milestoneId: int
    txHash:      str


# ─────────────────────────────────────────────────────────────────────────────
# Password helpers
# ─────────────────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ─────────────────────────────────────────────────────────────────────────────
# Session helpers
# ─────────────────────────────────────────────────────────────────────────────

def create_session(db: Session, user_id: int) -> str:
    """Generate a random session token, store its hash, return the raw token."""
    raw_token = secrets.token_hex(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=SESSION_DAYS)
    db.add(UserSession(user_id=user_id, token_hash=token_hash, expires_at=expires))
    db.commit()
    return raw_token


def get_session_user(db: Session, raw_token: str) -> Optional[User]:
    """Look up the session and return the user if the session is valid and not expired."""
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    session = db.query(UserSession).filter_by(token_hash=token_hash).first()
    if not session:
        return None
    if session.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        db.delete(session)
        db.commit()
        return None
    return db.get(User, session.user_id)


# ─────────────────────────────────────────────────────────────────────────────
# Auth dependencies — inject into protected routes
# ─────────────────────────────────────────────────────────────────────────────

def get_current_user(
    db: Session = Depends(get_db),
    session_token: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> User:
    """Return the logged-in user or raise 401."""
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = get_session_user(db, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please log in again.")
    return user


def require_role(allowed_roles: list[str]):
    """Factory: returns a dependency that enforces one of the given roles."""
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"This action requires one of: {', '.join(allowed_roles)}. Your role is: {user.role}",
            )
        return user
    return dep


# ─────────────────────────────────────────────────────────────────────────────
# Dict helpers — convert ORM objects to the JSON the frontend expects
# ─────────────────────────────────────────────────────────────────────────────

def funding_received(db: Session, startup_id: int) -> float:
    startup = db.get(Startup, startup_id)
    if not startup or not startup.funding_round:
        return 0
    # Only sum INR investments for the fiat funding display.
    # ETH investments are shown separately.
    return sum(i.amount for i in startup.funding_round.investments if (i.currency or "INR") == "INR")


def startup_to_dict(db: Session, s: Startup) -> dict:
    eth_raised = 0.0
    if s.funding_round:
        eth_raised = sum(i.amount for i in s.funding_round.investments if (i.currency or "INR") == "ETH")
    return {
        "id":              s.id,
        "name":            s.name,
        "description":     s.description,
        "industry":        s.industry,
        "founder":         s.founder_name,
        "founderId":       s.founder_id,
        "team":            s.team or [],
        "fundingRequired": s.funding_required,
        "fundingReceived": funding_received(db, s.id),
        "ethRaised":       eth_raised,   # test ETH raised on-chain (separate from INR)
        "status":          s.status,
        "pitchDeck":       s.pitch_deck,
        "tags":            s.tags or [],
        "submittedDate":   s.submitted_date,
        "contractAddress": s.funding_round.contract_address if s.funding_round else None,
    }


def milestone_to_dict(m: Milestone) -> dict:
    evidence = m.evidences[0].file_name if m.evidences else None
    return {
        "id":              m.id,
        "startupId":       m.startup_id,
        "title":           m.title,
        "description":     m.description,
        "amount":          m.amount,
        "status":          m.status,
        "order":           m.order,
        "evidence":        evidence,
        "completedDate":   m.completed_at,
        "releaseTxHash":   m.release_tx_hash,
        "milestoneIndex":  m.milestone_index,
    }


def proposal_to_dict(db: Session, p: Proposal, current_user_id: Optional[int] = None) -> dict:
    startup = db.get(Startup, p.startup_id)
    # Check whether this specific user has voted on this proposal.
    voted = None
    if current_user_id is not None:
        voted = db.query(Vote).filter_by(proposal_id=p.id, user_id=current_user_id).first()

    # Count total eligible DAO members (for quorum display).
    dao_count = db.query(User).filter_by(role="DAO Member").count()

    # Is the voting period still open?
    now = datetime.now()
    deadline = p.voting_deadline
    deadline_passed = (deadline is not None) and (now > deadline)
    time_remaining = None
    if deadline and not deadline_passed:
        delta = deadline - now
        hours = int(delta.total_seconds() // 3600)
        minutes = int((delta.total_seconds() % 3600) // 60)
        time_remaining = f"{hours}h {minutes}m"

    return {
        "id":                 p.id,
        "proposalNumber":     str(p.id).zfill(3),
        "startupId":          p.startup_id,
        "startupName":        startup.name if startup else None,
        "type":               p.type,
        "title":              p.title,
        "description":        p.description or "",
        "yesVotes":           p.yes_votes,
        "noVotes":            p.no_votes,
        "requiredPercentage": p.required_percentage,
        "requiredQuorum":     p.required_quorum,
        "eligibleVoters":     dao_count,
        "votingDeadline":     deadline.isoformat() if deadline else None,
        "deadlinePassed":     deadline_passed,
        "timeRemaining":      time_remaining,
        "status":             p.status,
        "milestoneId":        p.milestone_id,
        "milestoneTitle":     p.milestone_title,
        "milestoneAmount":    p.milestone_amount,
        "evidence":           p.evidence,
        "submittedDate":      p.submitted_date,
        "hasVoted":           voted is not None,
        "userVote":           voted.vote if voted else None,
    }


def user_to_dict(u: User) -> dict:
    """Safe user dict — never includes password_hash."""
    return {
        "id":        u.id,
        "name":      u.name,
        "email":     u.email,
        "role":      u.role,
        "createdAt": u.created_at,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Seed data — disabled. The application starts with an empty database.
# Real users must register through /api/auth/register.
# If you need test data, use a separate test script with a test database.
# ─────────────────────────────────────────────────────────────────────────────

def seed_if_empty():
    """No-op: automatic seeding is disabled. Set SEED_ON_STARTUP=true only for
    explicit local development, and only if this function is restored."""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Fundora API", version="2.0.0")

# ── Upload directory setup ──────────────────────────────────────────────────
# Files survive container restarts because /app/data is a mounted volume.
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/data/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# CORS: allow cookies from the exact frontend origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded evidence files at /uploads/<filename>
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}


# ─────────────────────────────────────────────────────────────────────────────
# Auth routes
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/auth/register")
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Create a new user account and log them in immediately."""
    if payload.role not in ("Founder", "Investor", "DAO Member"):
        raise HTTPException(status_code=400, detail="Role must be Founder, Investor, or DAO Member.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    # Reject duplicate email
    if db.query(User).filter_by(email=payload.email.lower()).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create a session and set the HttpOnly cookie.
    token = create_session(db, user.id)
    # secure=False for local HTTP dev; set True behind HTTPS in production.
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=SESSION_DAYS * 86400,
    )
    return user_to_dict(user)


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Verify credentials and return a session cookie."""
    user = db.query(User).filter_by(email=payload.email.lower()).first()
    # Reject if user doesn't exist, has no password (demo/seed user), or password doesn't match.
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = create_session(db, user.id)
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=SESSION_DAYS * 86400,
    )
    return user_to_dict(user)


@app.post("/api/auth/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    session_token: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
):
    """Invalidate the current session."""
    if session_token:
        token_hash = hashlib.sha256(session_token.encode()).hexdigest()
        session = db.query(UserSession).filter_by(token_hash=token_hash).first()
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: User = Depends(get_current_user)):
    """Return the logged-in user. Frontend calls this on load to restore session."""
    return user_to_dict(user)


# ─────────────────────────────────────────────────────────────────────────────
# Startups — public reads, authenticated writes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/startups")
def list_startups(db: Session = Depends(get_db)):
    """Public: anyone can browse startups."""
    startups = db.query(Startup).order_by(Startup.id).all()
    return [startup_to_dict(db, s) for s in startups]


@app.post("/api/startups")
def create_startup(
    payload: StartupCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_role(["Founder"])),
):
    """Founders only. Creates startup + milestones, auto-approves, and
    attempts on-chain registration. If on-chain registration fails, the
    startup is still saved in the DB with a clear status."""
    import subprocess, json as _json, math

    # Validate milestones if provided
    ms_data = payload.milestones or []
    if ms_data:
        total_ms = sum(m.get("amount", 0) for m in ms_data)
        if abs(total_ms - payload.fundingRequired) > 0.01:
            raise HTTPException(status_code=400,
                detail=f"Milestone amounts (₹{total_ms:,.0f}) must sum to funding target (₹{payload.fundingRequired:,.0f}).")
        for m in ms_data:
            if not m.get("title", "").strip():
                raise HTTPException(status_code=400, detail="Every milestone needs a title.")
            if m.get("amount", 0) <= 0:
                raise HTTPException(status_code=400, detail="Milestone amounts must be positive.")

    startup = Startup(
        name=payload.name,
        description=payload.description,
        industry=payload.industry,
        founder_id=user.id,
        founder_name=user.name,
        team=payload.team,
        funding_required=payload.fundingRequired,
        status="Approved",   # no manual DAO approval needed for startup listing
        pitch_deck=payload.pitchDeck,
        tags=payload.tags or [payload.industry],
        submitted_date=date.today(),
    )
    db.add(startup)
    db.flush()

    db.add(FundingRound(startup_id=startup.id, target_amount=payload.fundingRequired,
                        equity_offered=10.0, status="Open"))

    # Create milestones from the founder's input
    milestone_rows = []
    if ms_data:
        for i, m in enumerate(ms_data):
            ms = Milestone(
                startup_id=startup.id,
                title=m["title"],
                description=m.get("description", ""),
                amount=float(m["amount"]),
                status="Locked",
                order=i,
            )
            db.add(ms)
            milestone_rows.append(ms)
        db.flush()
    else:
        # Default: one milestone = full target
        ms = Milestone(
            startup_id=startup.id,
            title="Funding Tranche 1",
            description="Initial funding tranche",
            amount=float(payload.fundingRequired),
            status="Locked",
            order=0,
        )
        db.add(ms)
        milestone_rows.append(ms)
        db.flush()

    # Try on-chain registration immediately
    contract_addr = os.getenv("CONTRACT_ADDRESS", "").strip()
    if not contract_addr:
        # Try /shared/deployment.json (Docker volume)
        for dpath in ["/shared/deployment.json",
                      os.path.join(os.path.dirname(__file__), "../frontend/src/blockchain/deployment.json")]:
            if os.path.exists(dpath):
                with open(dpath) as f:
                    contract_addr = _json.load(f).get("contractAddress", "")
                if contract_addr:
                    break

    on_chain_result = None
    if contract_addr:
        try:
            titles  = [m.title for m in milestone_rows]
            total_r = sum(m.amount for m in milestone_rows)
            target_wei = int(payload.fundingRequired * 10**18)
            amounts = []
            running = 0
            for i, m in enumerate(milestone_rows):
                if i == len(milestone_rows) - 1:
                    amounts.append(target_wei - running)
                else:
                    wei = math.floor((m.amount / total_r) * target_wei)
                    amounts.append(wei)
                    running += wei

            script_path = os.path.join(os.path.dirname(__file__),
                                       "blockchain/register_startup.js")
            env = {**os.environ,
                   "CONTRACT_ADDRESS": contract_addr,
                   "HARDHAT_RPC_URL":  os.getenv("HARDHAT_RPC_URL", "http://127.0.0.1:8545")}
            cmd = [
                "node", script_path,
                str(startup.id),
                startup.name,
                "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",  # deployer as placeholder founder
                str(target_wei),
                "2",  # requiredVotes
                _json.dumps(titles),
                _json.dumps(amounts),
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60, env=env)
            if result.returncode == 0:
                data = _json.loads(result.stdout.strip())
                startup.funding_round.contract_address = contract_addr
                for i, m in enumerate(milestone_rows):
                    m.milestone_index = i
                on_chain_result = {"txHash": data.get("txHash"), "contractAddress": contract_addr}
            else:
                on_chain_result = {"error": result.stderr.strip()[:200]}
        except Exception as e:
            on_chain_result = {"error": str(e)[:200]}

    db.commit()
    db.refresh(startup)
    resp = startup_to_dict(db, startup)
    if on_chain_result:
        resp["onChainRegistration"] = on_chain_result
    return resp


# ─────────────────────────────────────────────────────────────────────────────
# Investments — Investors only
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/startups/{startup_id}/investments")
def create_investment(
    startup_id: int,
    payload:    InvestmentCreate,
    db:         Session = Depends(get_db),
    user:       User    = Depends(require_role(["Investor"])),
):
    """Investors only. Investment is attributed to the authenticated user."""
    startup = db.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    if not startup.funding_round:
        raise HTTPException(status_code=404, detail="Startup has no funding round")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Investment amount must be positive.")
    committed = funding_received(db, startup_id)
    remaining = startup.funding_round.target_amount - committed
    if payload.amount > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Investment of ₹{payload.amount:,.0f} exceeds remaining target (₹{remaining:,.0f} left).",
        )

    investment = Investment(
        round_id=startup.funding_round.id,
        investor_id=user.id,
        amount=payload.amount,
        currency="INR",          # off-chain simulated investment is always INR
        tx_hash=payload.txHash,
        wallet_address=payload.walletAddress,
    )
    db.add(investment)
    db.commit()
    db.refresh(investment)
    return {
        "id":            investment.id,
        "roundId":       investment.round_id,
        "investorId":    investment.investor_id,
        "investorName":  user.name,
        "amount":        investment.amount,
        "currency":      investment.currency,
        "txHash":        investment.tx_hash,
        "walletAddress": investment.wallet_address,
        "createdAt":     investment.created_at,
    }


@app.get("/api/my/investments")
def my_investments(
    db:   Session = Depends(get_db),
    user: User    = Depends(require_role(["Investor"])),
):
    """Return only the authenticated investor's own investments."""
    investments = (
        db.query(Investment)
        .filter_by(investor_id=user.id)
        .order_by(Investment.created_at.desc())
        .all()
    )
    result = []
    for inv in investments:
        startup_name = None
        if inv.round and inv.round.startup:
            startup_name = inv.round.startup.name
        result.append({
            "id":            inv.id,
            "amount":        inv.amount,
            "currency":      inv.currency or "INR",
            "txHash":        inv.tx_hash,
            "walletAddress": inv.wallet_address,
            "createdAt":     inv.created_at,
            "startupName":   startup_name,
        })
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Milestones — public reads, Founder writes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/milestones")
def list_milestones(db: Session = Depends(get_db)):
    """Public: anyone can see milestones."""
    milestones = db.query(Milestone).order_by(Milestone.startup_id, Milestone.order).all()
    return [milestone_to_dict(m) for m in milestones]


@app.post("/api/milestones/{milestone_id}/evidence")
def submit_evidence(
    milestone_id: int,
    payload:      EvidenceCreate,
    db:           Session = Depends(get_db),
    user:         User    = Depends(require_role(["Founder"])),
):
    """Founders only — and only for milestones on their own startups."""
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")

    # Enforce ownership: the startup must belong to this founder.
    startup = db.get(Startup, milestone.startup_id)
    if not startup or startup.founder_id != user.id:
        raise HTTPException(status_code=403, detail="You can only submit evidence for your own startup's milestones.")

    if milestone.status == "Completed":
        raise HTTPException(status_code=400, detail="Milestone already completed.")
    if milestone.status == "Pending DAO Approval":
        raise HTTPException(status_code=400, detail="This milestone is already under DAO review.")

    # Enforce sequential unlocking: a Locked milestone can only accept evidence
    # if it is the first milestone OR the previous milestone is Completed.
    if milestone.status == "Locked":
        prev = db.query(Milestone).filter_by(
            startup_id=milestone.startup_id, order=milestone.order - 1
        ).first()
        if milestone.order > 0 and (not prev or prev.status != "Completed"):
            raise HTTPException(status_code=400,
                detail="Previous milestone must be completed before this one can be unlocked.")

    # Locked milestones become In Progress once evidence is submitted.

    db.add(MilestoneEvidence(milestone_id=milestone.id, file_name=payload.fileName, notes=payload.notes))
    milestone.status = "Pending DAO Approval"
    # Set 48-hour voting deadline from now.
    voting_deadline = datetime.now() + timedelta(hours=48)
    # Quorum = number of DAO members at submission time (minimum 1).
    dao_count = db.query(User).filter_by(role="DAO Member").count()
    required_quorum = 1  # simplified demo quorum: 1 valid DAO vote
    db.add(Proposal(
        startup_id=startup.id, type="Milestone Approval",
        title=f"Release Milestone Funds — {startup.name}",
        description=milestone.description, milestone_id=milestone.id,
        milestone_title=milestone.title, milestone_amount=milestone.amount,
        evidence=payload.fileName, status="Pending",
        submitted_date=date.today(),
        voting_deadline=voting_deadline,
        required_quorum=required_quorum,
    ))
    db.commit()
    return {"milestoneId": milestone.id, "fileName": payload.fileName, "status": "Pending DAO Approval",
            "votingDeadline": voting_deadline.isoformat()}


@app.post("/api/milestones/{milestone_id}/evidence/upload")
async def upload_evidence_file(
    milestone_id: int,
    file:         UploadFile = File(...),
    notes:        str        = Form(""),
    db:           Session    = Depends(get_db),
    user:         User       = Depends(require_role(["Founder"])),
):
    """Upload a real file (PDF or image) as milestone evidence. Founder only, own startup."""
    import shutil, uuid as _uuid

    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    startup = db.get(Startup, milestone.startup_id)
    if not startup or startup.founder_id != user.id:
        raise HTTPException(status_code=403, detail="You can only upload evidence for your own startup's milestones.")
    if milestone.status == "Completed":
        raise HTTPException(status_code=400, detail="Milestone already completed.")
    if milestone.status == "Pending DAO Approval":
        raise HTTPException(status_code=400, detail="This milestone is already under DAO review.")

    # Enforce sequential unlocking: a Locked milestone can only accept evidence
    # if it is the first milestone OR the previous milestone is Completed.
    if milestone.status == "Locked":
        prev = db.query(Milestone).filter_by(
            startup_id=milestone.startup_id, order=milestone.order - 1
        ).first()
        if milestone.order > 0 and (not prev or prev.status != "Completed"):
            raise HTTPException(status_code=400,
                detail="Previous milestone must be completed before this one can be unlocked.")

    # Validate file type
    allowed = {"application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"}
    content_type = file.content_type or ""
    if content_type not in allowed and not file.filename.lower().endswith((".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp")):
        raise HTTPException(status_code=400, detail="Only PDF and image files are accepted.")

    # Save with unique name to avoid collisions
    ext = os.path.splitext(file.filename)[-1] or ".bin"
    unique_name = f"ms{milestone_id}_{_uuid.uuid4().hex[:8]}{ext}"
    save_path = os.path.join(UPLOAD_DIR, unique_name)
    with open(save_path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    # Record in DB and start voting period
    voting_deadline = datetime.now() + timedelta(hours=48)
    dao_count = db.query(User).filter_by(role="DAO Member").count()
    required_quorum = 1  # simplified demo quorum: 1 valid DAO vote

    ev = MilestoneEvidence(
        milestone_id=milestone.id,
        file_name=file.filename,
        file_path=unique_name,
        notes=notes,
    )
    db.add(ev)
    milestone.status = "Pending DAO Approval"

    db.add(Proposal(
        startup_id=startup.id, type="Milestone Approval",
        title=f"Release Milestone Funds — {startup.name}",
        description=milestone.description, milestone_id=milestone.id,
        milestone_title=milestone.title, milestone_amount=milestone.amount,
        evidence=unique_name, status="Pending",
        submitted_date=date.today(),
        voting_deadline=voting_deadline,
        required_quorum=required_quorum,
    ))
    db.commit()
    return {
        "milestoneId": milestone.id,
        "fileName":    file.filename,
        "filePath":    unique_name,
        "evidenceUrl": f"/uploads/{unique_name}",
        "status":      "Pending DAO Approval",
        "votingDeadline": voting_deadline.isoformat(),
    }


@app.get("/api/milestones/{milestone_id}/evidence")
def get_milestone_evidence(
    milestone_id: int,
    db:           Session = Depends(get_db),
    user:         User    = Depends(get_current_user),
):
    """Authenticated users can view evidence for a milestone."""
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return [
        {
            "id":          e.id,
            "fileName":    e.file_name,
            "filePath":    e.file_path,
            "evidenceUrl": f"/uploads/{e.file_path}" if e.file_path else None,
            "notes":       e.notes,
            "status":      e.status,
            "submittedAt": e.submitted_at,
        }
        for e in milestone.evidences
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Proposals and voting — public reads, DAO Member writes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/proposals")
def list_proposals(
    db:           Session          = Depends(get_db),
    session_token: Optional[str]   = Cookie(default=None, alias=SESSION_COOKIE),
):
    """Public listing. If logged in, personalises hasVoted for the current user."""
    # Derive user_id if a valid session exists (but don't require auth).
    current_user_id = None
    if session_token:
        user = get_session_user(db, session_token)
        if user:
            current_user_id = user.id
    proposals = db.query(Proposal).order_by(Proposal.id).all()
    return [proposal_to_dict(db, p, current_user_id) for p in proposals]


@app.post("/api/proposals/{proposal_id}/vote")
def cast_vote(
    proposal_id: int,
    payload:     VoteCreate,
    db:          Session = Depends(get_db),
    user:        User    = Depends(require_role(["DAO Member"])),
):
    """DAO Members only — one vote per user per proposal. Enforces 48-hour window and quorum."""
    if payload.vote not in ("yes", "no"):
        raise HTTPException(status_code=400, detail="Vote must be 'yes' or 'no'.")
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    if proposal.status != "Pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already {proposal.status}.")

    # Enforce voting deadline for milestone proposals.
    if proposal.voting_deadline and datetime.now() > proposal.voting_deadline:
        raise HTTPException(status_code=409,
            detail="The 48-hour voting period for this proposal has ended.")

    already = db.query(Vote).filter_by(proposal_id=proposal.id, user_id=user.id).first()
    if already:
        raise HTTPException(status_code=409, detail="You have already voted on this proposal.")

    db.add(Vote(proposal_id=proposal.id, user_id=user.id, vote=payload.vote))
    if payload.vote == "yes":
        proposal.yes_votes += 1
    else:
        proposal.no_votes += 1

    # Auto-finalize when quorum is met AND approval threshold is met.
    now = datetime.now()
    total = proposal.yes_votes + proposal.no_votes
    quorum = proposal.required_quorum or 1
    quorum_met = total >= quorum
    approval_pct = (proposal.yes_votes / total * 100) if total > 0 else 0

    if proposal.voting_deadline is None:
        # Startup approvals: finalize immediately on percentage threshold.
        if approval_pct >= proposal.required_percentage:
            proposal.status = "Approved"
            if proposal.type == "Startup Approval":
                startup = db.get(Startup, proposal.startup_id)
                if startup:
                    startup.status = "Approved"
    elif quorum_met and approval_pct >= proposal.required_percentage:
        # Milestone proposals: auto-approve when quorum + threshold are met.
        milestone = db.get(Milestone, proposal.milestone_id) if proposal.milestone_id else None
        if milestone:
            milestone.status = "Completed"
            milestone.completed_at = date.today()
            if milestone.evidences:
                milestone.evidences[0].status = "Approved"
        proposal.status = "Approved"
    elif quorum_met and (proposal.no_votes / total * 100) >= (100 - proposal.required_percentage):
        # If enough NO votes to make approval impossible, auto-reject.
        milestone = db.get(Milestone, proposal.milestone_id) if proposal.milestone_id else None
        if milestone:
            milestone.status = "In Progress"
            if milestone.evidences:
                milestone.evidences[0].status = "Rejected"
        proposal.status = "Rejected"

    db.commit()
    db.refresh(proposal)
    return proposal_to_dict(db, proposal, user.id)


@app.post("/api/proposals/{proposal_id}/approve-milestone")
def approve_milestone(
    proposal_id: int,
    db:          Session = Depends(get_db),
    user:        User    = Depends(require_role(["DAO Member"])),
):
    """DAO Members only. Can only finalize AFTER the 48-hour voting deadline, when quorum
    and approval threshold are met."""
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    if proposal.type != "Milestone Approval":
        raise HTTPException(status_code=400, detail="Not a milestone proposal.")
    if proposal.status != "Pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already {proposal.status}.")

    # Allow finalization when EITHER quorum is met OR the 48-hour deadline has passed.
    total_votes = proposal.yes_votes + proposal.no_votes
    quorum = proposal.required_quorum or 1
    quorum_met = total_votes >= quorum
    deadline_passed = (proposal.voting_deadline is None) or (datetime.now() > proposal.voting_deadline)

    if not quorum_met and not deadline_passed:
        remaining = proposal.voting_deadline - datetime.now()
        hours = int(remaining.total_seconds() // 3600)
        mins  = int((remaining.total_seconds() % 3600) // 60)
        raise HTTPException(status_code=409,
            detail=f"Voting is still open. {hours}h {mins}m remaining. {total_votes}/{quorum} votes cast — quorum not yet reached.")

    # If deadline passed but quorum not met, reject.
    if deadline_passed and not quorum_met:
        raise HTTPException(status_code=409,
            detail=f"Voting deadline passed but quorum not reached: {total_votes}/{quorum} votes cast.")

    # Enforce approval threshold.
    approval_pct = (proposal.yes_votes / total_votes * 100) if total_votes > 0 else 0
    if approval_pct < proposal.required_percentage:
        raise HTTPException(status_code=409,
            detail=f"Approval threshold not met: {approval_pct:.0f}% YES ({proposal.yes_votes}/{total_votes} votes), {proposal.required_percentage}% required.")

    committed = funding_received(db, proposal.startup_id)
    if proposal.milestone_amount and proposal.milestone_amount > committed:
        raise HTTPException(
            status_code=400,
            detail=f"Milestone tranche exceeds committed funding (₹{committed:,.0f}).",
        )

    milestone = db.get(Milestone, proposal.milestone_id) if proposal.milestone_id else None
    if milestone:
        milestone.status = "Completed"
        milestone.completed_at = date.today()
        if milestone.evidences:
            milestone.evidences[0].status = "Approved"

    proposal.status = "Approved"
    db.commit()
    db.refresh(proposal)
    return proposal_to_dict(db, proposal, user.id)


@app.post("/api/proposals/{proposal_id}/reject-milestone")
def reject_milestone(
    proposal_id: int,
    db:          Session = Depends(get_db),
    user:        User    = Depends(require_role(["DAO Member"])),
):
    """DAO Members only. Can reject after quorum is met OR deadline passed."""
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    if proposal.type != "Milestone Approval":
        raise HTTPException(status_code=400, detail="Not a milestone proposal.")
    if proposal.status != "Pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already {proposal.status}.")

    # Allow rejection when quorum is met OR deadline has passed.
    total_votes = proposal.yes_votes + proposal.no_votes
    quorum = proposal.required_quorum or 1
    quorum_met = total_votes >= quorum
    deadline_passed = (proposal.voting_deadline is None) or (datetime.now() > proposal.voting_deadline)

    if not quorum_met and not deadline_passed:
        remaining = proposal.voting_deadline - datetime.now()
        hours = int(remaining.total_seconds() // 3600)
        mins  = int((remaining.total_seconds() % 3600) // 60)
        raise HTTPException(status_code=409,
            detail=f"Voting is still open. {hours}h {mins}m remaining. {total_votes}/{quorum} votes cast.")

    milestone = db.get(Milestone, proposal.milestone_id) if proposal.milestone_id else None
    if milestone:
        milestone.status = "In Progress"
        if milestone.evidences:
            milestone.evidences[0].status = "Rejected"

    proposal.status = "Rejected"
    db.commit()
    db.refresh(proposal)
    return proposal_to_dict(db, proposal, user.id)


# ─────────────────────────────────────────────────────────────────────────────
# Blockchain record endpoints — authenticated
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/proposals/{proposal_id}/finalize")
def finalize_proposal(
    proposal_id: int,
    db:          Session = Depends(get_db),
    user:        User    = Depends(get_current_user),
):
    """Any authenticated user can finalize a milestone proposal after quorum is met
    or after the 48-hour deadline."""
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found.")
    if proposal.type != "Milestone Approval":
        raise HTTPException(status_code=400, detail="Only milestone proposals can be finalized this way.")
    if proposal.status != "Pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already {proposal.status}.")

    total_votes = proposal.yes_votes + proposal.no_votes
    quorum = proposal.required_quorum or 1
    quorum_met = total_votes >= quorum
    deadline_passed = (proposal.voting_deadline is None) or (datetime.now() > proposal.voting_deadline)

    if not quorum_met and not deadline_passed:
        remaining = proposal.voting_deadline - datetime.now()
        hours = int(remaining.total_seconds() // 3600)
        mins  = int((remaining.total_seconds() % 3600) // 60)
        raise HTTPException(status_code=409,
            detail=f"Voting is still open. {hours}h {mins}m remaining. {total_votes}/{quorum} votes cast.")

    total_votes = proposal.yes_votes + proposal.no_votes
    quorum = proposal.required_quorum or 1
    approval_pct = (proposal.yes_votes / total_votes * 100) if total_votes > 0 else 0

    if total_votes >= quorum and approval_pct >= proposal.required_percentage:
        # Quorum met and approval threshold passed → approve.
        milestone = db.get(Milestone, proposal.milestone_id) if proposal.milestone_id else None
        if milestone:
            milestone.status = "Completed"
            milestone.completed_at = date.today()
            if milestone.evidences:
                milestone.evidences[0].status = "Approved"
        proposal.status = "Approved"
    else:
        # Quorum not met or approval failed → reject.
        milestone = db.get(Milestone, proposal.milestone_id) if proposal.milestone_id else None
        if milestone:
            milestone.status = "In Progress"
            if milestone.evidences:
                milestone.evidences[0].status = "Rejected"
        proposal.status = "Rejected"

    db.commit()
    db.refresh(proposal)
    return proposal_to_dict(db, proposal, user.id)


@app.post("/api/blockchain/register")
def record_contract_registration(
    payload: BlockchainRegisterPayload,
    db:      Session = Depends(get_db),
    user:    User    = Depends(require_role(["Founder"])),
):
    """Founders only — record on-chain registration for their own startup."""
    startup = db.get(Startup, payload.startupId)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found.")
    if startup.founder_id != user.id:
        raise HTTPException(status_code=403, detail="You can only register your own startup on-chain.")
    if not startup.funding_round:
        raise HTTPException(status_code=404, detail="Startup has no funding round.")
    startup.funding_round.contract_address = payload.contractAddress
    db.commit()
    return {"ok": True, "contractAddress": payload.contractAddress, "txHash": payload.txHash}


class OnChainRegisterRequest(BaseModel):
    founderWalletAddress: str   # MetaMask address that will receive milestone payouts


@app.post("/api/blockchain/register-startup/{startup_id}")
def register_startup_on_chain(
    startup_id: int,
    payload:    OnChainRegisterRequest,
    db:         Session = Depends(get_db),
    user:       User    = Depends(require_role(["Founder"])),
):
    """
    Trigger on-chain registration of a DAO-approved startup.
    The backend calls registerStartup() as the contract owner so founders
    do not need the deployer key. Returns txHash on success.
    """
    import subprocess, json as _json, math

    startup = db.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found.")
    if startup.founder_id != user.id:
        raise HTTPException(status_code=403, detail="You can only register your own startup.")
    if not startup.funding_round:
        raise HTTPException(status_code=400, detail="Startup has no funding round.")

    # Guard: if already registered on-chain, return the existing address without re-registering.
    if startup.funding_round.contract_address:
        return {
            "ok":              True,
            "startupId":       startup_id,
            "contractAddress": startup.funding_round.contract_address,
            "txHash":          None,
            "alreadyRegistered": True,
            "message": "Already registered on-chain. Returning existing contract address.",
        }

    contract_addr = os.getenv("CONTRACT_ADDRESS", "").strip()
    if not contract_addr:
        for dpath in ["/shared/deployment.json",
                      os.path.join(os.path.dirname(__file__), "../frontend/src/blockchain/deployment.json")]:
            if os.path.exists(dpath):
                with open(dpath) as f:
                    contract_addr = _json.load(f).get("contractAddress", "")
                if contract_addr:
                    break
    if not contract_addr:
        raise HTTPException(status_code=503,
            detail="Contract address not configured. Start the Hardhat node, deploy, and set CONTRACT_ADDRESS.")

    milestones = db.query(Milestone).filter_by(startup_id=startup.id).order_by(Milestone.order).all()
    if not milestones:
        # Default: one milestone tranche = full target
        titles   = ["Funding Tranche 1"]
        amounts  = [int(startup.funding_round.target_amount * 10**18)]
    else:
        titles   = [m.title for m in milestones]
        # Convert ₹ amounts to wei fractions proportionally summing to target
        total_rupees = sum(m.amount for m in milestones)
        target_wei   = int(startup.funding_round.target_amount * 10**18)
        amounts = []
        running = 0
        for i, m in enumerate(milestones):
            if i == len(milestones) - 1:
                amounts.append(target_wei - running)
            else:
                wei = math.floor((m.amount / total_rupees) * target_wei)
                amounts.append(wei)
                running += wei

    target_wei     = int(startup.funding_round.target_amount * 10**18)
    required_votes = 2  # minimum YES votes to release a milestone

    # Call the Node.js registration script
    script_path = os.path.join(os.path.dirname(__file__),
                                "blockchain/register_startup.js")
    node_bin = "node"

    env = {**os.environ,
           "CONTRACT_ADDRESS": contract_addr,
           "HARDHAT_RPC_URL":  os.getenv("HARDHAT_RPC_URL", "http://127.0.0.1:8545")}

    cmd = [
        node_bin, script_path,
        str(startup_id),
        startup.name,
        payload.founderWalletAddress,
        str(target_wei),
        str(required_votes),
        _json.dumps(titles),
        _json.dumps(amounts),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60, env=env)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="On-chain registration timed out.")
    except FileNotFoundError:
        raise HTTPException(status_code=503,
            detail="node binary not found. Ensure Node.js is installed.")

    if result.returncode != 0:
        err = result.stderr.strip()
        try:
            err = _json.loads(err).get("error", err)
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=f"On-chain registration failed: {err}")

    try:
        data = _json.loads(result.stdout.strip())
    except Exception:
        raise HTTPException(status_code=502, detail=f"Unexpected script output: {result.stdout[:200]}")

    # Update the DB with the contract address
    startup.funding_round.contract_address = contract_addr

    # Set milestone_index values so on-chain releases map correctly
    for i, m in enumerate(milestones):
        m.milestone_index = i
    db.commit()

    return {
        "ok":              True,
        "startupId":       startup_id,
        "contractAddress": contract_addr,
        "txHash":          data.get("txHash"),
        "alreadyRegistered": data.get("alreadyRegistered", False),
    }


@app.post("/api/blockchain/invest")
def record_onchain_investment(
    payload: BlockchainInvestPayload,
    db:      Session = Depends(get_db),
    user:    User    = Depends(require_role(["Investor"])),
):
    """Investors only — record a confirmed on-chain investment for the logged-in investor."""
    startup = db.get(Startup, payload.startupId)
    if not startup or not startup.funding_round:
        raise HTTPException(status_code=404, detail="Startup or funding round not found.")

    investment = Investment(
        round_id=startup.funding_round.id,
        investor_id=user.id,
        amount=payload.amountEth,   # ETH amount (not wei, not INR)
        currency="ETH",
        tx_hash=payload.txHash,
        wallet_address=payload.walletAddress,
    )
    db.add(investment)
    db.commit()
    db.refresh(investment)
    return {"ok": True, "investmentId": investment.id, "txHash": payload.txHash,
            "amountEth": payload.amountEth, "currency": "ETH"}


@app.post("/api/blockchain/release")
def record_milestone_release(
    payload: BlockchainReleasePayload,
    db:      Session = Depends(get_db),
    user:    User    = Depends(require_role(["DAO Member"])),
):
    """DAO Members only — record a confirmed on-chain milestone release."""
    milestone = db.get(Milestone, payload.milestoneId)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found.")
    milestone.release_tx_hash = payload.txHash
    milestone.status           = "Completed"
    milestone.completed_at     = date.today()
    db.commit()
    return {"ok": True, "milestoneId": milestone.id, "txHash": payload.txHash}


@app.get("/api/blockchain/startup/{startup_id}")
def get_blockchain_info(startup_id: int, db: Session = Depends(get_db)):
    """Public — on-chain details for a startup."""
    startup = db.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found.")
    investments = []
    if startup.funding_round:
        investments = [
            {"id": i.id, "amount": i.amount, "txHash": i.tx_hash, "wallet": i.wallet_address}
            for i in startup.funding_round.investments
            if i.tx_hash
        ]
    milestones = [
        {"id": m.id, "title": m.title, "releaseTxHash": m.release_tx_hash, "milestoneIndex": m.milestone_index}
        for m in startup.milestones
    ]
    return {
        "startupId":          startup_id,
        "contractAddress":    startup.funding_round.contract_address if startup.funding_round else None,
        "onChainInvestments": investments,
        "milestones":         milestones,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Database initialisation and migration
# ─────────────────────────────────────────────────────────────────────────────

Base.metadata.create_all(bind=engine)


def _add_column_if_missing(table: str, column: str, col_type: str):
    import sqlite3
    db_path = DATABASE_URL.replace("sqlite:///", "")
    con = sqlite3.connect(db_path)
    cols = [row[1] for row in con.execute(f"PRAGMA table_info({table})")]
    if column not in cols:
        con.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        con.commit()
        print(f"Migrated: added {table}.{column}")
    con.close()


# Blockchain columns (from Milestone 4)
_add_column_if_missing("investments",    "tx_hash",          "TEXT")
_add_column_if_missing("investments",    "wallet_address",   "TEXT")
_add_column_if_missing("milestones",     "release_tx_hash",  "TEXT")
_add_column_if_missing("milestones",     "milestone_index",  "INTEGER")
_add_column_if_missing("funding_rounds", "contract_address", "TEXT")

# ── Database initialisation ────────────────────────────────────────────────────
# Seed demo data only when SEED_ON_STARTUP=true (off by default so production
# starts with an empty database). Set SEED_ON_STARTUP=true in docker-compose
# for local development so the marketplace isn't empty on first run.
SEED_ON_STARTUP = os.getenv("SEED_ON_STARTUP", "false").lower() in ("1", "true", "yes")

Base.metadata.create_all(bind=engine)

# Auth columns (Milestone 6)
_add_column_if_missing("users", "password_hash", "TEXT")

# New columns added in this milestone
_add_column_if_missing("investments",     "currency",          "TEXT DEFAULT 'INR'")
_add_column_if_missing("milestone_evidence", "file_path",      "TEXT")
_add_column_if_missing("proposals",       "voting_deadline",   "DATETIME")
_add_column_if_missing("proposals",       "required_quorum",   "INTEGER DEFAULT 1")

if SEED_ON_STARTUP:
    seed_if_empty()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
