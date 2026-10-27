"""
cd backend
uvicorn main:app --reload
http://localhost:8000/docs 
"""

from datetime import date, datetime
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import (
    Column, Integer, Float, String, Text, ForeignKey, JSON, Date, DateTime,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session
from sqlalchemy import create_engine


# ─────────────────────────────────────────────────────────────────────────────
# Database setup
# ─────────────────────────────────────────────────────────────────────────────

engine = create_engine(
    "sqlite:///./fundora.db",
    connect_args={"check_same_thread": False},  # needed by FastAPI + SQLite
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
# Models (database tables)
# ─────────────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    role = Column(String, nullable=False, default="Investor")  # Founder | Investor | DAO Member
    created_at = Column(DateTime, default=datetime.now)
    investments = relationship("Investment", back_populates="investor")
    votes = relationship("Vote", back_populates="user")


class Startup(Base):
    __tablename__ = "startups"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    industry = Column(String, default="Other")
    founder_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    founder_name = Column(String, nullable=True)
    team = Column(JSON, default=list)        # list of strings
    funding_required = Column(Float, nullable=False, default=0)
    status = Column(String, default="Pending")  # Pending | Approved | Rejected
    pitch_deck = Column(String, nullable=True)
    tags = Column(JSON, default=list)         # list of strings
    submitted_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    funding_round = relationship("FundingRound", uselist=False, back_populates="startup",
                                 cascade="all, delete-orphan")
    milestones = relationship("Milestone", back_populates="startup", cascade="all, delete-orphan")
    proposals = relationship("Proposal", back_populates="startup")


class FundingRound(Base):
    """A funding round for a startup. Equity terms live here, not on milestones."""
    __tablename__ = "funding_rounds"
    id = Column(Integer, primary_key=True)
    startup_id = Column(Integer, ForeignKey("startups.id"), nullable=False)
    target_amount = Column(Float, nullable=False, default=0)
    equity_offered = Column(Float, default=10.0)   # % offered to investors
    status = Column(String, default="Open")
    # Blockchain — set when the owner registers this startup on the contract.
    contract_address = Column(String, nullable=True)
    startup = relationship("Startup", back_populates="funding_round")
    investments = relationship("Investment", back_populates="round", cascade="all, delete-orphan")


class Investment(Base):
    """A simulated investment recorded against a funding round."""
    __tablename__ = "investments"
    id = Column(Integer, primary_key=True)
    round_id = Column(Integer, ForeignKey("funding_rounds.id"), nullable=False)
    investor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    # Blockchain fields — null until the investor confirms the on-chain tx.
    tx_hash = Column(String, nullable=True)
    wallet_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    round = relationship("FundingRound", back_populates="investments")
    investor = relationship("User", back_populates="investments")


class Milestone(Base):
    """A milestone tranche that draws from the startup's committed funding."""
    __tablename__ = "milestones"
    id = Column(Integer, primary_key=True)
    startup_id = Column(Integer, ForeignKey("startups.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    amount = Column(Float, nullable=False, default=0)
    status = Column(String, default="Locked")  # Completed | In Progress | Locked | Pending DAO Approval
    order = Column(Integer, default=0)
    completed_at = Column(Date, nullable=True)
    # Blockchain fields — null until the DAO approves and funds are released on-chain.
    release_tx_hash = Column(String, nullable=True)
    milestone_index = Column(Integer, nullable=True)  # 0-based index in the contract
    created_at = Column(DateTime, default=datetime.now)
    startup = relationship("Startup", back_populates="milestones")
    evidences = relationship("MilestoneEvidence", back_populates="milestone",
                            cascade="all, delete-orphan",
                            order_by="MilestoneEvidence.submitted_at.desc()")


class MilestoneEvidence(Base):
    """Evidence submitted for a milestone. Submitting it does NOT release funds."""
    __tablename__ = "milestone_evidence"
    id = Column(Integer, primary_key=True)
    milestone_id = Column(Integer, ForeignKey("milestones.id"), nullable=False)
    file_name = Column(String, nullable=False)
    notes = Column(Text, default="")
    status = Column(String, default="Pending")  # Pending | Approved | Rejected
    submitted_at = Column(DateTime, default=datetime.now)
    milestone = relationship("Milestone", back_populates="evidences")


class Proposal(Base):
    """A DAO proposal: either a startup approval or a milestone approval."""
    __tablename__ = "proposals"
    id = Column(Integer, primary_key=True)
    startup_id = Column(Integer, ForeignKey("startups.id"), nullable=False)
    type = Column(String, nullable=False)     # Startup Approval | Milestone Approval
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    # Only used for milestone proposals:
    milestone_id = Column(Integer, nullable=True)
    milestone_title = Column(String, nullable=True)
    milestone_amount = Column(Float, nullable=True)
    evidence = Column(String, nullable=True)
    yes_votes = Column(Integer, default=0)
    no_votes = Column(Integer, default=0)
    required_percentage = Column(Integer, default=60)
    status = Column(String, default="Pending")  # Pending | Approved | Rejected
    submitted_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    startup = relationship("Startup", back_populates="proposals")
    votes = relationship("Vote", back_populates="proposal", cascade="all, delete-orphan")


class Vote(Base):
    """One user's vote on a proposal (one user = one vote per proposal)."""
    __tablename__ = "votes"
    id = Column(Integer, primary_key=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    vote = Column(String, nullable=False)    # yes | no
    created_at = Column(DateTime, default=datetime.now)
    proposal = relationship("Proposal", back_populates="votes")
    user = relationship("User", back_populates="votes")


# ─────────────────────────────────────────────────────────────────────────────
# Request schemas (Pydantic). Field names match the JSON the frontend sends.
# ─────────────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: str
    role: str = "Investor"


class StartupCreate(BaseModel):
    name: str
    description: str
    industry: str = "Other"
    team: list = []
    fundingRequired: float
    pitchDeck: Optional[str] = None
    tags: list = []
    founderId: Optional[int] = None


class InvestmentCreate(BaseModel):
    amount: float
    investorId: Optional[int] = None
    txHash: Optional[str] = None          # on-chain transaction hash
    walletAddress: Optional[str] = None   # investor's MetaMask address


class EvidenceCreate(BaseModel):
    fileName: str
    notes: str = ""


class VoteCreate(BaseModel):
    vote: str        # "yes" or "no"
    userId: Optional[int] = None


class BlockchainRegisterPayload(BaseModel):
    """Posted by the frontend after the owner registers a startup on-chain."""
    startupId: int
    contractAddress: str
    txHash: str


class BlockchainInvestPayload(BaseModel):
    """Posted by the frontend after an on-chain investment is confirmed."""
    startupId: int
    txHash: str
    walletAddress: str
    amountEth: float   # ETH value sent — stored for display only


class BlockchainReleasePayload(BaseModel):
    """Posted by the frontend after a milestone release tx is confirmed."""
    milestoneId: int
    txHash: str


# Demo users used as defaults when the frontend doesn't send a specific user id.
# The prototype has no real login, so each role maps to a seeded demo user.
DEMO_USERS = {"Founder": 1, "Investor": 2, "DAO Member": 3}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — turn ORM rows into the JSON the frontend expects
# ─────────────────────────────────────────────────────────────────────────────

def funding_received(db, startup_id):
    """Total money committed to a startup = sum of investments on its round."""
    startup = db.get(Startup, startup_id)
    if not startup or not startup.funding_round:
        return 0
    return sum(i.amount for i in startup.funding_round.investments)


def startup_to_dict(db, s):
    return {
        "id": s.id,
        "name": s.name,
        "description": s.description,
        "industry": s.industry,
        "founder": s.founder_name,
        "founderId": s.founder_id,
        "team": s.team or [],
        "fundingRequired": s.funding_required,
        "fundingReceived": funding_received(db, s.id),
        "status": s.status,
        "pitchDeck": s.pitch_deck,
        "tags": s.tags or [],
        "submittedDate": s.submitted_date,
        "contractAddress": s.funding_round.contract_address if s.funding_round else None,
    }


def milestone_to_dict(m):
    evidence = m.evidences[0].file_name if m.evidences else None
    return {
        "id": m.id,
        "startupId": m.startup_id,
        "title": m.title,
        "description": m.description,
        "amount": m.amount,
        "status": m.status,
        "order": m.order,
        "evidence": evidence,
        "completedDate": m.completed_at,
        "releaseTxHash": m.release_tx_hash,
        "milestoneIndex": m.milestone_index,
    }


def proposal_to_dict(db, p, user_id=3):
    startup = db.get(Startup, p.startup_id)
    voted = db.query(Vote).filter_by(proposal_id=p.id, user_id=user_id).first()
    return {
        "id": p.id,
        "proposalNumber": str(p.id).zfill(3),
        "startupId": p.startup_id,
        "startupName": startup.name if startup else None,
        "type": p.type,
        "title": p.title,
        "description": p.description or "",
        "yesVotes": p.yes_votes,
        "noVotes": p.no_votes,
        "requiredPercentage": p.required_percentage,
        "status": p.status,
        "milestoneId": p.milestone_id,
        "milestoneTitle": p.milestone_title,
        "milestoneAmount": p.milestone_amount,
        "evidence": p.evidence,
        "submittedDate": p.submitted_date,
        "hasVoted": voted is not None,
        "userVote": voted.vote if voted else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Seed data — loaded once on first run so the demo is never empty
# ─────────────────────────────────────────────────────────────────────────────

def seed_if_empty():
    db = SessionLocal()
    try:
        if db.query(Startup).count() > 0:
            return  # already seeded

        # Users
        users = [
            ("Arjun Mehta", "arjun@fundora.io", "Founder"),     # 1 demo founder
            ("Priya Nair", "priya@fundora.io", "Investor"),      # 2 demo investor
            ("Vikram Rao", "vikram@fundora.io", "DAO Member"),  # 3 demo DAO member
            ("Sneha Patel", "sneha@fundora.io", "Founder"),
            ("Dr. Meera Nair", "meera@fundora.io", "Founder"),
            ("Rohit Bansal", "rohit@fundora.io", "Founder"),
            ("Neha Kapoor", "neha@fundora.io", "Investor"),
            ("Karan Malhotra", "karan@fundora.io", "Investor"),
        ]
        for name, email, role in users:
            db.add(User(name=name, email=email, role=role))
        db.flush()
        u = {user.email: user.id for user in db.query(User).all()}

        # Startups
        startups = [
            dict(name="EcoTech Solutions", industry="Clean Technology",
                 description="Building solar-powered IoT devices for real-time environmental monitoring in rural India. Our sensors track air quality, water levels, and soil health to support sustainable agriculture.",
                 founder_id=u["arjun@fundora.io"], founder_name="Arjun Mehta",
                 team=["Arjun Mehta (CEO)", "Priya Sharma (CTO)", "Ravi Kumar (COO)"],
                 funding_required=1000000, status="Approved", pitch_deck="EcoTech_PitchDeck_v2.pdf",
                 tags=["IoT", "Sustainability", "AgriTech"], submitted_date=date(2024, 11, 15)),
            dict(name="AgriNova", industry="AgriTech",
                 description="AI-driven precision farming platform that uses satellite imagery and machine learning to predict crop yields, detect diseases early, and optimise irrigation schedules for small-scale farmers.",
                 founder_id=u["sneha@fundora.io"], founder_name="Sneha Patel",
                 team=["Sneha Patel (CEO)", "Karan Joshi (ML Lead)", "Amit Verma (Dev)"],
                 funding_required=750000, status="Approved", pitch_deck="AgriNova_PitchDeck.pdf",
                 tags=["AI", "Farming", "SaaS"], submitted_date=date(2024, 12, 1)),
            dict(name="HealthBridge", industry="HealthTech",
                 description="Telemedicine platform connecting rural patients with specialist doctors via video consultations, with AI-assisted preliminary diagnosis and digital prescription management.",
                 founder_id=u["meera@fundora.io"], founder_name="Dr. Meera Nair",
                 team=["Dr. Meera Nair (CEO)", "Suresh Iyer (CTO)", "Anita Das (CMO)"],
                 funding_required=1200000, status="Pending", pitch_deck="HealthBridge_Deck.pdf",
                 tags=["Telemedicine", "Rural Health", "AI"], submitted_date=date(2025, 1, 10)),
            dict(name="FinNest", industry="FinTech",
                 description="Micro-investment platform for Gen Z, enabling users to invest spare change from daily transactions into diversified ETF portfolios with as little as ₹10 per transaction.",
                 founder_id=u["rohit@fundora.io"], founder_name="Rohit Bansal",
                 team=["Rohit Bansal (CEO)", "Neha Singh (CFO)", "Dev Gupta (CTO)"],
                 funding_required=500000, status="Approved", pitch_deck="FinNest_PitchDeck.pdf",
                 tags=["Micro-investment", "Gen Z", "ETF"], submitted_date=date(2025, 1, 20)),
        ]
        for s in startups:
            db.add(Startup(**s))
        db.flush()
        sm = {s.name: s for s in db.query(Startup).all()}

        # Funding rounds (equity terms belong to the round, not milestones)
        for startup in sm.values():
            db.add(FundingRound(startup_id=startup.id, target_amount=startup.funding_required,
                                equity_offered=10.0, status="Open"))
        db.flush()
        rounds = {r.startup_id: r for r in db.query(FundingRound).all()}

        # Seed investments: AgriNova and FinNest are partly funded. EcoTech
        # starts unfunded so the demo investor can fund it during the demo.
        db.add(Investment(round_id=rounds[sm["AgriNova"].id].id, investor_id=u["neha@fundora.io"], amount=300000))
        db.add(Investment(round_id=rounds[sm["FinNest"].id].id, investor_id=u["karan@fundora.io"], amount=200000))

        # Milestones
        milestones = {
            "EcoTech Solutions": [
                ("Prototype Development", 200000, "Completed", 1, date(2025, 1, 10),
                 "Build a working hardware prototype of the IoT sensor unit and test it in controlled lab conditions."),
                ("MVP Development", 200000, "In Progress", 2, None,
                 "Develop the mobile app and cloud dashboard for real-time sensor data visualisation. Deploy 10 units in pilot farms in Maharashtra."),
                ("First 100 Users", 200000, "Locked", 3, None,
                 "Acquire 100 paying farmers through direct outreach and NGO partnerships. Target Maharashtra and Karnataka districts."),
                ("Series A Readiness", 400000, "Locked", 4, None,
                 "Achieve ₹5L MRR, prepare financial statements, and pitch to institutional investors for Series A funding round."),
            ],
            "AgriNova": [
                ("Platform Beta Launch", 150000, "Completed", 1, date(2025, 2, 1),
                 "Launch beta version of the precision farming dashboard with satellite imagery integration for 50 pilot farms."),
                ("ML Model Accuracy", 200000, "In Progress", 2, None,
                 "Achieve >85% accuracy on crop yield prediction model. Train on dataset of 10,000+ farms."),
                ("500 Farmer Onboarding", 400000, "Locked", 3, None,
                 "Onboard 500 farmers across 3 states with full platform access and support."),
            ],
            "FinNest": [
                ("App Launch (iOS & Android)", 150000, "Completed", 1, date(2025, 1, 30),
                 "Launch FinNest app on both app stores with core micro-investment feature and KYC integration."),
                ("10,000 Active Users", 200000, "In Progress", 2, None,
                 "Reach 10,000 monthly active users with at least ₹1 invested per user. Focus on college campuses."),
                ("SEBI Compliance & Scale", 150000, "Locked", 3, None,
                 "Obtain SEBI registration and scale to 1,00,000 users."),
            ],
        }
        for startup_name, items in milestones.items():
            startup = sm[startup_name]
            for title, amount, status, order, completed_at, desc in items:
                db.add(Milestone(startup_id=startup.id, title=title, description=desc,
                                 amount=amount, status=status, order=order, completed_at=completed_at))
        db.flush()

        # DAO proposals (startup approvals). Vote tallies are stored directly.
        db.add(Proposal(startup_id=sm["EcoTech Solutions"].id, type="Startup Approval",
                        title="Approve EcoTech Solutions for Incubation",
                        description="EcoTech Solutions proposes to build solar-powered IoT devices for environmental monitoring.",
                        yes_votes=8, no_votes=2, status="Approved", submitted_date=date(2024, 11, 18)))
        db.add(Proposal(startup_id=sm["AgriNova"].id, type="Startup Approval",
                        title="Approve AgriNova for Incubation",
                        description="AgriNova presents an AI-driven precision farming platform.",
                        yes_votes=7, no_votes=3, status="Approved", submitted_date=date(2024, 12, 4)))
        db.add(Proposal(startup_id=sm["HealthBridge"].id, type="Startup Approval",
                        title="Approve HealthBridge for Incubation",
                        description="HealthBridge aims to democratise healthcare access in rural India via telemedicine.",
                        yes_votes=2, no_votes=2, status="Pending", submitted_date=date(2025, 1, 12)))

        db.commit()
        print("Seeded Fundora demo data.")
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app + routes
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Fundora API", version="1.0.0")

# The frontend (Vite on :5173) and backend (uvicorn on :8000) are different
# origins, so we allow all origins during local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}


# ── Users ────────────────────────────────────────────────────────────────────

@app.get("/api/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id).all()
    return [
        {"id": u.id, "name": u.name, "email": u.email, "role": u.role, "createdAt": u.created_at}
        for u in users
    ]


@app.post("/api/users")
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if payload.role not in ("Founder", "Investor", "DAO Member"):
        raise HTTPException(status_code=400, detail="Invalid role")
    user = User(name=payload.name, email=payload.email, role=payload.role)
    db.add(user)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "role": user.role, "createdAt": user.created_at}


# ── Startups ─────────────────────────────────────────────────────────────────

@app.get("/api/startups")
def list_startups(db: Session = Depends(get_db)):
    startups = db.query(Startup).order_by(Startup.id).all()
    return [startup_to_dict(db, s) for s in startups]


@app.post("/api/startups")
def create_startup(payload: StartupCreate, db: Session = Depends(get_db)):
    founder_id = payload.founderId or DEMO_USERS["Founder"]
    founder = db.get(User, founder_id)
    startup = Startup(
        name=payload.name,
        description=payload.description,
        industry=payload.industry,
        founder_id=founder_id,
        founder_name=founder.name if founder else "Unknown",
        team=payload.team,
        funding_required=payload.fundingRequired,
        status="Pending",
        pitch_deck=payload.pitchDeck,
        tags=payload.tags or [payload.industry],
        submitted_date=date.today(),
    )
    db.add(startup)
    db.flush()  # get the new id

    # Open a funding round (equity lives on the round, not milestones).
    db.add(FundingRound(startup_id=startup.id, target_amount=payload.fundingRequired,
                        equity_offered=10.0, status="Open"))
    # Auto-create a DAO proposal so the community can vote on it.
    db.add(Proposal(startup_id=startup.id, type="Startup Approval",
                    title=f"Approve {startup.name} for Incubation",
                    description=payload.description, status="Pending",
                    submitted_date=date.today()))

    db.commit()
    db.refresh(startup)
    return startup_to_dict(db, startup)


# ── Investments ──────────────────────────────────────────────────────────────

@app.post("/api/startups/{startup_id}/investments")
def create_investment(startup_id: int, payload: InvestmentCreate, db: Session = Depends(get_db)):
    startup = db.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    if not startup.funding_round:
        raise HTTPException(status_code=404, detail="Startup has no funding round")

    # Rule: amount must be positive and cannot exceed the remaining target.
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Investment amount must be positive")
    committed = funding_received(db, startup_id)
    remaining = startup.funding_round.target_amount - committed
    if payload.amount > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Investment of ₹{payload.amount:,.0f} exceeds remaining target (₹{remaining:,.0f} left).",
        )

    investor_id = payload.investorId or DEMO_USERS["Investor"]
    investor = db.get(User, investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    investment = Investment(
        round_id=startup.funding_round.id,
        investor_id=investor_id,
        amount=payload.amount,
        tx_hash=payload.txHash,
        wallet_address=payload.walletAddress,
    )
    db.add(investment)
    db.commit()
    db.refresh(investment)
    return {
        "id": investment.id, "roundId": investment.round_id, "investorId": investment.investor_id,
        "investorName": investor.name, "amount": investment.amount,
        "txHash": investment.tx_hash, "walletAddress": investment.wallet_address,
        "createdAt": investment.created_at,
    }


# ── Milestones ───────────────────────────────────────────────────────────────

@app.get("/api/milestones")
def list_milestones(db: Session = Depends(get_db)):
    """All milestones (the frontend groups them by startupId)."""
    milestones = db.query(Milestone).order_by(Milestone.startup_id, Milestone.order).all()
    return [milestone_to_dict(m) for m in milestones]


@app.post("/api/milestones/{milestone_id}/evidence")
def submit_evidence(milestone_id: int, payload: EvidenceCreate, db: Session = Depends(get_db)):
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    if milestone.status == "Completed":
        raise HTTPException(status_code=400, detail="Milestone already completed")
    if milestone.status == "Locked":
        raise HTTPException(status_code=400, detail="Milestone is locked")

    startup = db.get(Startup, milestone.startup_id)

    # Record evidence. This does NOT release any funds.
    db.add(MilestoneEvidence(milestone_id=milestone.id, file_name=payload.fileName, notes=payload.notes))

    # Move the milestone into the DAO review queue and create a proposal.
    milestone.status = "Pending DAO Approval"
    db.add(Proposal(
        startup_id=startup.id, type="Milestone Approval",
        title=f"Release Milestone Funds — {startup.name}",
        description=milestone.description, milestone_id=milestone.id,
        milestone_title=milestone.title, milestone_amount=milestone.amount,
        evidence=payload.fileName, status="Pending", submitted_date=date.today(),
    ))

    db.commit()
    return {"milestoneId": milestone.id, "fileName": payload.fileName, "status": "Pending DAO Approval"}


# ── DAO proposals & voting ───────────────────────────────────────────────────

@app.get("/api/proposals")
def list_proposals(db: Session = Depends(get_db)):
    proposals = db.query(Proposal).order_by(Proposal.id).all()
    return [proposal_to_dict(db, p) for p in proposals]


@app.post("/api/proposals/{proposal_id}/vote")
def cast_vote(proposal_id: int, payload: VoteCreate, db: Session = Depends(get_db)):
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status != "Pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already {proposal.status}")

    user_id = payload.userId or DEMO_USERS["DAO Member"]

    # Rule: one user = one vote.
    already = db.query(Vote).filter_by(proposal_id=proposal.id, user_id=user_id).first()
    if already:
        raise HTTPException(status_code=409, detail="You have already voted on this proposal")

    db.add(Vote(proposal_id=proposal.id, user_id=user_id, vote=payload.vote))
    if payload.vote == "yes":
        proposal.yes_votes += 1
    else:
        proposal.no_votes += 1

    # If approval reaches the threshold, mark the proposal approved.
    total = proposal.yes_votes + proposal.no_votes
    if total > 0 and (proposal.yes_votes / total * 100) >= proposal.required_percentage:
        proposal.status = "Approved"
        # Approving a startup proposal also approves the startup.
        if proposal.type == "Startup Approval":
            startup = db.get(Startup, proposal.startup_id)
            if startup:
                startup.status = "Approved"

    db.commit()
    db.refresh(proposal)
    return proposal_to_dict(db, proposal, user_id)


@app.post("/api/proposals/{proposal_id}/approve-milestone")
def approve_milestone(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.type != "Milestone Approval":
        raise HTTPException(status_code=400, detail="Not a milestone proposal")
    if proposal.status != "Pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already {proposal.status}")

    # Rule: a milestone tranche cannot exceed the committed funding.
    committed = funding_received(db, proposal.startup_id)
    if proposal.milestone_amount and proposal.milestone_amount > committed:
        raise HTTPException(
            status_code=400,
            detail=f"Milestone tranche (₹{proposal.milestone_amount:,.0f}) exceeds committed funding (₹{committed:,.0f}).",
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
    return proposal_to_dict(db, proposal)


@app.post("/api/proposals/{proposal_id}/reject-milestone")
def reject_milestone(proposal_id: int, db: Session = Depends(get_db)):
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.type != "Milestone Approval":
        raise HTTPException(status_code=400, detail="Not a milestone proposal")
    if proposal.status != "Pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already {proposal.status}")

    milestone = db.get(Milestone, proposal.milestone_id) if proposal.milestone_id else None
    if milestone:
        milestone.status = "In Progress"  # founder can resubmit
        if milestone.evidences:
            milestone.evidences[0].status = "Rejected"

    proposal.status = "Rejected"
    db.commit()
    db.refresh(proposal)
    return proposal_to_dict(db, proposal)


# ── Blockchain record endpoints ──────────────────────────────────────────────
# These endpoints let the frontend record confirmed on-chain transactions in
# the database. They do NOT trigger any on-chain action themselves — the
# frontend sends the tx to MetaMask first, waits for confirmation, then
# calls these endpoints so the off-chain database stays in sync.

@app.post("/api/blockchain/register")
def record_contract_registration(payload: BlockchainRegisterPayload, db: Session = Depends(get_db)):
    """Record the contract address after a startup is registered on-chain."""
    startup = db.get(Startup, payload.startupId)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    if not startup.funding_round:
        raise HTTPException(status_code=404, detail="Startup has no funding round")
    startup.funding_round.contract_address = payload.contractAddress
    db.commit()
    return {"ok": True, "contractAddress": payload.contractAddress, "txHash": payload.txHash}


@app.post("/api/blockchain/invest")
def record_onchain_investment(payload: BlockchainInvestPayload, db: Session = Depends(get_db)):
    """Record a confirmed on-chain investment. Creates an Investment row with the tx hash."""
    startup = db.get(Startup, payload.startupId)
    if not startup or not startup.funding_round:
        raise HTTPException(status_code=404, detail="Startup or funding round not found")
    # Store amount in the same unit as the rest of the app (₹ equiv / display).
    # amountEth is stored separately so the UI can show ETH values.
    investor_id = DEMO_USERS["Investor"]
    investment = Investment(
        round_id=startup.funding_round.id,
        investor_id=investor_id,
        amount=payload.amountEth,  # stored as ETH float for on-chain investments
        tx_hash=payload.txHash,
        wallet_address=payload.walletAddress,
    )
    db.add(investment)
    # Update the startup's raised total (in ETH) — kept consistent with on-chain state.
    db.commit()
    db.refresh(investment)
    return {"ok": True, "investmentId": investment.id, "txHash": payload.txHash}


@app.post("/api/blockchain/release")
def record_milestone_release(payload: BlockchainReleasePayload, db: Session = Depends(get_db)):
    """Record a confirmed on-chain milestone release tx. Marks the milestone Completed."""
    milestone = db.get(Milestone, payload.milestoneId)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    milestone.release_tx_hash = payload.txHash
    milestone.status = "Completed"
    milestone.completed_at = date.today()
    db.commit()
    return {"ok": True, "milestoneId": milestone.id, "txHash": payload.txHash}


@app.get("/api/blockchain/startup/{startup_id}")
def get_blockchain_info(startup_id: int, db: Session = Depends(get_db)):
    """Return the on-chain details stored for a startup (contract address, tx hashes)."""
    startup = db.get(Startup, startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    investments = []
    if startup.funding_round:
        investments = [
            {"id": i.id, "amount": i.amount, "txHash": i.tx_hash, "wallet": i.wallet_address}
            for i in startup.funding_round.investments
            if i.tx_hash  # only on-chain confirmed ones
        ]
    milestones = [
        {"id": m.id, "title": m.title, "releaseTxHash": m.release_tx_hash, "milestoneIndex": m.milestone_index}
        for m in startup.milestones
    ]
    return {
        "startupId": startup_id,
        "contractAddress": startup.funding_round.contract_address if startup.funding_round else None,
        "onChainInvestments": investments,
        "milestones": milestones,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Create tables and seed demo data when the server starts.
# ─────────────────────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# Migrate existing database: add new blockchain columns if they don't exist yet.
# SQLite supports ALTER TABLE ADD COLUMN but not IF NOT EXISTS, so we check first.
def _add_column_if_missing(table, column, col_type):
    import sqlite3
    con = sqlite3.connect("./fundora.db")
    cols = [row[1] for row in con.execute(f"PRAGMA table_info({table})")]
    if column not in cols:
        con.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        con.commit()
        print(f"Migrated: added {table}.{column}")
    con.close()

_add_column_if_missing("investments",   "tx_hash",          "TEXT")
_add_column_if_missing("investments",   "wallet_address",   "TEXT")
_add_column_if_missing("milestones",    "release_tx_hash",  "TEXT")
_add_column_if_missing("milestones",    "milestone_index",  "INTEGER")
_add_column_if_missing("funding_rounds","contract_address", "TEXT")

seed_if_empty()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
