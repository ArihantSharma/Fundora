# Fundora — Decentralised Startup Incubation Platform

> **Milestone 1 Frontend Prototype**

A fully clickable UI/UX prototype built with React + Vite demonstrating the complete Fundora user flow.

---

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Demo Flow (for Presentation)

### Step 1 — Founder registers a startup
1. Go to `/auth`, select **Founder**, click Sign In
2. From Dashboard click **Register Startup** (or navigate to `/register-startup`)
3. Fill in startup details → **Submit for DAO Approval**

### Step 2 — DAO votes to approve
1. Switch role to **DAO Member** (top navbar)
2. Navigate to **DAO** → find the pending proposal
3. Click **Vote YES** → watch approval % update in real time

### Step 3 — Investor funds the startup
1. Switch role to **Investor**
2. Go to **Marketplace** → open **EcoTech Solutions**
3. Click **Fund Startup** → enter ₹6,00,000 → **Confirm Funding**

### Step 4 — Founder submits milestone evidence
1. Switch role to **Founder**
2. Go to **Milestones** → find **MVP Development** (In Progress)
3. Click **Submit Evidence** → attach file → Submit to DAO

### Step 5 — DAO approves milestone & releases funds
1. Switch role to **DAO Member**
2. Go to **DAO** → find the milestone proposal
3. Click **Approve Milestone** → see **₹2,00,000 Released** 🎉

---

## Pages

| Route | Page |
|---|---|
| `/` | Landing |
| `/auth` | Login / Register |
| `/dashboard` | Role-aware dashboard (Founder / Investor / DAO) |
| `/register-startup` | Startup registration form |
| `/marketplace` | Startup cards with search & filter |
| `/startup/:id` | Startup detail + funding modal |
| `/dao` | DAO proposals + voting |
| `/milestones` | Milestone tracker + evidence submission |

---

## Tech Stack

- React 18
- Vite 8
- React Router v7
- Plain CSS (no UI library)
- All data is local JS objects — no backend

---

## Project Structure

```
src/
├── components/
│   └── Navbar.jsx
├── context/
│   └── AppContext.jsx      ← global state + actions
├── data/
│   ├── startups.js
│   ├── milestones.js
│   └── proposals.js
├── pages/
│   ├── Landing.jsx
│   ├── Auth.jsx
│   ├── Dashboard.jsx
│   ├── RegisterStartup.jsx
│   ├── Marketplace.jsx
│   ├── StartupDetails.jsx
│   ├── DAOProposals.jsx
│   └── Milestones.jsx
├── App.jsx
├── main.jsx
└── index.css
```

---

*This is Milestone 1 — frontend prototype only. Backend, smart contracts, and real wallet integration will be added in later milestones.*
