# Fundora

A college project demonstrating a **decentralised startup incubation platform** with milestone-based funding and DAO governance.

Founders register startups, a DAO community votes to approve them, investors fund them with simulated ₹ amounts **or real test ETH via MetaMask**, and funds are released in milestone tranches only after the DAO approves each one — enforced by a Solidity smart contract.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router v7, ethers.js v6, plain CSS |
| Backend | Python 3, FastAPI, SQLAlchemy, SQLite |
| Smart contracts | Solidity 0.8.24, Hardhat 2, hardhat-toolbox |
| Local blockchain | Hardhat in-process / `hardhat node` (Chain ID 31337) |

---

## Project Structure

```
Fundora/
├── frontend/                  React + Vite app
│   ├── src/
│   │   ├── blockchain/
│   │   │   ├── contract.js        MetaMask helpers + on-chain calls
│   │   │   └── FundoraFunding.json  Contract ABI (auto-generated)
│   │   ├── context/AppContext.jsx   All state + API + blockchain actions
│   │   ├── components/Navbar.jsx    Wallet connect button
│   │   ├── pages/                   8 pages
│   │   └── index.css
│   ├── .env                   VITE_CONTRACT_ADDRESS (copy from .env.example)
│   └── package.json
│
├── backend/
│   ├── main.py                Entire backend: models, seed, all routes
│   └── requirements.txt
│
├── blockchain/
│   ├── contracts/
│   │   └── FundoraFunding.sol   Escrow + voting + milestone release
│   ├── scripts/
│   │   └── deploy.js
│   ├── test/
│   │   └── FundoraFunding.test.js  24 tests
│   └── hardhat.config.js
│
├── .gitignore
└── README.md
```

---

## Prerequisites

- **Node.js** v18+ (`node --version`)
- **Python** 3.10+ (`python3 --version`)
- **MetaMask** browser extension — [metamask.io](https://metamask.io)

---

## Running the Project

You need **three terminals** for the full on-chain demo.

### Terminal 1 — Hardhat local blockchain node

```bash
cd blockchain
npx hardhat node
```

Leaves a local Ethereum node running at **http://127.0.0.1:8545** (Chain ID 31337).  
It prints 20 funded test accounts. Copy **Account #0**'s private key — you will import it into MetaMask.

### Terminal 2 — Deploy the smart contract

Run this once each time you start a fresh Hardhat node:

```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

Copy the printed contract address, then paste it into `frontend/.env`:

```
VITE_CONTRACT_ADDRESS=<address printed above>
```

The address is already prefilled with the default Hardhat deployment address (`0x5FbDB…`). It stays the same as long as no other contracts are deployed first.

### Terminal 3 — Backend

```bash
cd backend

# First time only
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Start
.venv/bin/uvicorn main:app --reload
```

Backend starts at **http://localhost:8000**.  
API docs: **http://localhost:8000/docs**  
The SQLite database (`backend/fundora.db`) is created automatically and seeded with demo data on first run.

### Terminal 4 — Frontend

```bash
cd frontend
npm install        # first time only
npm run dev
```

Frontend starts at **http://localhost:5173**.

---

## Connecting MetaMask to the Local Network

1. Open MetaMask → **Settings → Networks → Add a network manually**

| Field | Value |
|---|---|
| Network Name | Hardhat Local |
| RPC URL | http://127.0.0.1:8545 |
| Chain ID | 31337 |
| Currency Symbol | ETH |

2. Import a test account: **Import account → Private key**  
   Paste the private key of **Account #0** from the `npx hardhat node` output.  
   It comes pre-loaded with 10,000 test ETH.

3. In the Fundora UI, click **Connect Wallet** in the navbar.

> ⚠️ These are test accounts with no real value. Never send real ETH to a Hardhat address.

---

## Demo Workflow

Use the **"View as"** role switcher in the top navbar to switch roles without logging in.

### Simulated demo (no MetaMask needed)

1. **Founder** → Register Startup → Submit for DAO Approval
2. **DAO Member** → DAO page → Vote YES → startup becomes Approved
3. **Investor** → Marketplace → EcoTech Solutions → Fund Startup (₹) → Confirm
4. **Founder** → Milestones → Submit Evidence on MVP Development
5. **DAO Member** → DAO page → Approve Milestone (Simulated) → ₹2,00,000 Released

### On-chain demo (MetaMask connected)

1. Start Hardhat node, deploy contract, configure MetaMask (see above)
2. Click **Connect Wallet** in the navbar — shows address and ETH balance
3. **Investor** → Marketplace → EcoTech Solutions → Fund Startup → switch to **On-chain (ETH)** tab → enter amount → **Send ETH** → confirm in MetaMask
4. **DAO Member** → DAO page → find milestone proposal → **Approve On-chain** → confirm in MetaMask → tx hash shown
5. **Founder** → Milestones → milestone shows Completed with on-chain tx hash

---

## Smart Contract: FundoraFunding.sol

| Function | Who calls it | What it does |
|---|---|---|
| `registerStartup(...)` | Owner (deployer) | Register a startup with milestones and target |
| `fundStartup(id)` | Investor | Send ETH — held in escrow |
| `approveMilestone(id, index)` | DAO member | Cast a YES vote |
| `releaseMilestone(id, index)` | Owner | Transfer tranche to founder when votes ≥ required |
| `getStartupInfo(id)` | Anyone | Read startup state |
| `getMilestoneInfo(id, index)` | Anyone | Read milestone state |

Rules enforced by the contract:
- Contributions cannot be zero or exceed the remaining target
- Each address can only vote once per milestone
- A milestone can only be released once
- Release only succeeds when `yesVotes >= requiredVotes`

### Run tests

```bash
cd blockchain
npx hardhat test
# 24 tests, all passing
```

### Compile only

```bash
cd blockchain
npx hardhat compile
```

---

## API Endpoints (FastAPI)

With the backend running, open **http://localhost:8000/docs** for the full interactive reference.

Key endpoints:

| Method | Path | Description |
|---|---|---|
| GET | `/api/startups` | List all startups |
| POST | `/api/startups` | Register a startup |
| POST | `/api/startups/{id}/investments` | Simulated investment |
| GET | `/api/milestones` | All milestones (flat) |
| POST | `/api/milestones/{id}/evidence` | Submit evidence |
| GET | `/api/proposals` | All DAO proposals |
| POST | `/api/proposals/{id}/vote` | Cast a vote |
| POST | `/api/proposals/{id}/approve-milestone` | Approve milestone (simulated) |
| POST | `/api/blockchain/register` | Record on-chain registration tx |
| POST | `/api/blockchain/invest` | Record confirmed on-chain investment |
| POST | `/api/blockchain/release` | Record confirmed milestone release |
| GET | `/api/blockchain/startup/{id}` | Get all on-chain data for a startup |

---

## Current Limitations

- **No real authentication** — the role switcher is a UI prototype shortcut
- **registerStartup on-chain** is a manual step — the owner calls it via Hardhat scripts or the frontend admin flow (not yet built)
- **Milestone index** — the contract uses a 0-based index; the DB stores `milestone_index` which must be set correctly to link them
- **No testnet deployment yet** — the contract runs only on the local Hardhat node; Sepolia deployment is straightforward but not automated
- **File uploads** are not stored server-side — evidence filenames are recorded but no actual files are saved
- **No Docker** yet — that is planned for Milestone 5

---

## Milestones Summary

| Milestone | Status |
|---|---|
| 1 — Frontend prototype (React + Vite) | ✅ Complete |
| 2 — (skipped / merged into 3) | — |
| 3 — Monorepo + FastAPI backend + SQLite | ✅ Complete |
| 4 — Smart contracts + MetaMask integration | ✅ Complete |
| 5 — Docker, testnet deployment | 🔜 Planned |
