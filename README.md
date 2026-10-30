# Fundora

A college project demonstrating a **decentralised startup incubation platform** with milestone-based funding, DAO governance, and real blockchain integration.

---

## What Fundora Does

- **Founders** register startups and submit milestone evidence
- **DAO Members** vote to approve startups and milestone releases
- **Investors** browse approved startups and fund them with simulated ₹ or real test ETH via MetaMask
- Funds are held in escrow by a Solidity smart contract and released in tranches only after DAO approval
- All user accounts are real — passwords are hashed, sessions are server-managed, and every endpoint is protected by role-based access control

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router v7, ethers.js v6, plain CSS |
| Backend | Python 3, FastAPI, SQLAlchemy, SQLite, bcrypt |
| Smart contracts | Solidity 0.8.24, Hardhat 2 |
| Auth | Server-side sessions (HttpOnly cookies), bcrypt password hashing |
| Container | Docker, Docker Compose |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (host machine)                                     │
│  ┌──────────────┐   HTTP :8000    ┌─────────────────────┐   │
│  │  React app   │ ──────────────▶ │  FastAPI backend    │   │
│  │  (port 5173) │  +cookie        │  SQLite on volume    │   │
│  └──────────────┘                 │  bcrypt passwords    │   │
│         │                         │  session cookies     │   │
│         │ MetaMask RPC             └─────────────────────┘   │
│         ▼ (port 8545)                                        │
│  ┌─────────────────┐                                        │
│  │  Hardhat node    │  ┌──────────────┐                      │
│  │  (Chain ID 31337)│  │  deploy svc  │                      │
│  └─────────────────┘  └──────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Roles and Permissions

| Role | Can do | Cannot do |
|---|---|---|
| **Founder** | Register startups, view own dashboard, submit milestone evidence for own startups | Invest, vote on proposals, approve milestones |
| **Investor** | Browse marketplace, invest (simulated or on-chain ETH), view own portfolio | Register startups, vote, approve milestones |
| **DAO Member** | View proposals, vote on startup approvals, approve/reject milestone releases | Register startups, invest |

Users **cannot change their role** after registration. The role is enforced by the backend on every protected endpoint — changing frontend state or API requests will not grant access.

---

## Authentication

### How it works

1. **Register** at `/api/auth/register` — name, email, password (min 8 chars), role
2. Password is hashed with **bcrypt** and stored in the database
3. A random session token is generated, its SHA-256 hash stored in the `user_sessions` table
4. The raw token is sent to the browser as an **HttpOnly cookie** (`fundora_session`)
5. Every subsequent request includes the cookie automatically (via `credentials: "include"`)
6. The backend validates the session on every protected request
7. **Logout** deletes the session from the database and clears the cookie
8. Sessions expire after **7 days**

### Security notes

- Passwords are never stored in plaintext or returned in API responses
- Session tokens are stored hashed (SHA-256) in the database — the raw token only exists in the cookie
- Seeded demo users have no password hash and **cannot log in**
- `SECRET_KEY` env var should be changed in production
- The cookie uses `secure=False` for local HTTP dev; set to `True` behind HTTPS in production

---

## Running the Project

### With Docker (recommended)

```bash
# First time or after code changes
docker compose up --build

# Subsequent runs
docker compose up
```

Wait ~60 seconds for all services. The frontend reads the contract address automatically from the deploy service.

**Stop (keep database):**
```bash
docker compose down
```

**Full reset (wipe database and blockchain):**
```bash
docker compose down -v
```

### Without Docker (local development)

**Terminal 1 — Hardhat node:**
```bash
cd blockchain && npm install && npx hardhat node
```

**Terminal 2 — Deploy contract:**
```bash
cd blockchain && npx hardhat run scripts/deploy.js --network localhost
# Copy VITE_CONTRACT_ADDRESS → paste into frontend/.env
```

**Terminal 3 — Backend:**
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
SEED_ON_STARTUP=true .venv/bin/uvicorn main:app --reload
```

**Terminal 4 — Frontend:**
```bash
cd frontend && npm install && npm run dev
```

---

## URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Hardhat RPC (MetaMask) | http://localhost:8545 |

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./fundora.db` | SQLite database path |
| `SECRET_KEY` | `change-this-in-production-please` | Session token signing |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `SEED_ON_STARTUP` | `false` | Set `true` to seed demo data on first run |
| `VITE_CONTRACT_ADDRESS` | (from deploy) | Smart contract address |
| `VITE_API_URL` | `http://localhost:8000` | Backend API URL for frontend |

---

## Database

- **SQLite** — single file, created automatically on first run
- **Persists** across restarts via Docker volume (`db-data`)
- **Migration** — new columns are added automatically via `ALTER TABLE` on startup
- **Seeding** — demo data (4 startups, milestones, proposals) is only inserted when `SEED_ON_STARTUP=true` and the database is empty
- **Backup** — copy the `fundora.db` file (or the Docker volume)
- **Reset** — delete the file or run `docker compose down -v`

### Tables

| Table | Purpose |
|---|---|
| `users` | Registered users with hashed passwords |
| `user_sessions` | Server-side session tokens (SHA-256 hashed) |
| `startups` | Registered startups |
| `funding_rounds` | Funding targets and contract addresses |
| `investments` | Investment records (simulated + on-chain) |
| `milestones` | Milestone tranches with release status |
| `milestone_evidence` | Evidence submitted by founders |
| `proposals` | DAO proposals (startup + milestone approvals) |
| `votes` | Individual votes by DAO members |

---

## Connecting MetaMask

1. MetaMask → **Settings → Networks → Add a network manually**
   - Network Name: `Hardhat Local`
   - RPC URL: `http://localhost:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`
2. **Import a test account** — copy the private key from the `docker compose up` output (Account #0, pre-loaded with 10,000 test ETH)
3. Click **Connect Wallet** in the Fundora navbar

> ⚠️ Test accounts only. Never send real ETH to a Hardhat address.

---

## Demo Workflow

### 1. Register and log in
- Go to http://localhost:5173/auth
- Register as a **Founder** (or Investor, or DAO Member)
- You are automatically logged in and redirected to your role's dashboard

### 2. Founder — Register a startup
- From the Founder dashboard, click **Register Startup**
- Fill in the form and submit → startup appears in DAO proposals

### 3. DAO Member — Vote to approve
- Log in as a DAO Member (register a new account with DAO Member role)
- Go to **DAO** → vote YES on the pending proposal
- Once approval reaches 60%, the startup is approved

### 4. Investor — Fund a startup
- Log in as an Investor
- Go to **Marketplace** → open a startup → **Fund Startup**
- Choose simulated (₹) or on-chain (ETH via MetaMask)

### 5. Founder — Submit milestone evidence
- Log in as the Founder who owns the startup
- Go to **Milestones** → submit evidence on an In Progress milestone

### 6. DAO Member — Approve milestone release
- Log in as a DAO Member
- Go to **DAO** → find the milestone proposal → **Approve Milestone**
- Funds are released (simulated or on-chain)

---

## Running Tests

### Smart contract tests (24 tests)
```bash
cd blockchain && npx hardhat test
```

### Frontend build
```bash
cd frontend && npm run build
```

### Backend
```bash
cd backend && .venv/bin/uvicorn main:app --reload
# Open http://localhost:8000/docs for interactive API testing
```

---

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create account + log in |
| POST | `/api/auth/login` | Public | Log in with email + password |
| POST | `/api/auth/logout` | Session | Invalidate session |
| GET | `/api/auth/me` | Session | Get current user |

### Startups
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/startups` | Public | List all startups |
| POST | `/api/startups` | Founder | Register a startup |

### Investments
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/startups/{id}/investments` | Investor | Simulated investment |
| GET | `/api/my/investments` | Investor | Own portfolio only |

### Milestones
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/milestones` | Public | List all milestones |
| POST | `/api/milestones/{id}/evidence` | Founder (own startup) | Submit evidence |

### DAO
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/proposals` | Public | List proposals (hasVoted personalised if logged in) |
| POST | `/api/proposals/{id}/vote` | DAO Member | Cast a vote (one per user) |
| POST | `/api/proposals/{id}/approve-milestone` | DAO Member | Approve milestone release |
| POST | `/api/proposals/{id}/reject-milestone` | DAO Member | Reject milestone |

### Blockchain
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/blockchain/register` | Founder (own startup) | Record on-chain registration |
| POST | `/api/blockchain/invest` | Investor | Record confirmed on-chain investment |
| POST | `/api/blockchain/release` | DAO Member | Record confirmed milestone release |
| GET | `/api/blockchain/startup/{id}` | Public | On-chain details (only tx_hash investments shown) |

---

## Common Errors

**"Not authenticated" (401)** — Your session expired or you haven't logged in. Go to `/auth` and log in.

**"This action requires one of: ..." (403)** — You are logged in but your role doesn't have permission for this action. Register an account with the correct role.

**"Incorrect email or password." (401)** — Either the email doesn't exist, the password is wrong, or the user is a seeded demo user (which has no password and cannot log in).

**"An account with this email already exists." (409)** — The email is already registered. Log in instead.

**"You have already voted on this proposal." (409)** — Each user can only vote once per proposal.

**"You can only submit evidence for your own startup's milestones." (403)** — Founders can only submit evidence for startups they registered.

---

## Limitations

- **No password reset** — not implemented in this milestone
- **No email verification** — not implemented
- **registerStartup on-chain** is a manual step (owner-only contract function)
- **Testnet deployment** — contract runs on Hardhat localhost only
- **File uploads** — evidence filenames are recorded but no actual files are stored server-side
- **Investor dashboard** — portfolio display is partially hardcoded in the frontend; the `/api/my/investments` endpoint provides real data
- **No Docker** for Milestone 6 testing was run — Docker Compose config is provided but tests were run locally
