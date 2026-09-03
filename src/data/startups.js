export const startups = [
  {
    id: 1,
    name: "EcoTech Solutions",
    industry: "Clean Technology",
    description:
      "Building solar-powered IoT devices for real-time environmental monitoring in rural India. Our sensors track air quality, water levels, and soil health to support sustainable agriculture.",
    founder: "Arjun Mehta",
    team: ["Arjun Mehta (CEO)", "Priya Sharma (CTO)", "Ravi Kumar (COO)"],
    fundingRequired: 1000000,
    fundingReceived: 600000,
    status: "Approved",
    pitchDeck: "EcoTech_PitchDeck_v2.pdf",
    tags: ["IoT", "Sustainability", "AgriTech"],
    submittedDate: "2024-11-15",
  },
  {
    id: 2,
    name: "AgriNova",
    industry: "AgriTech",
    description:
      "AI-driven precision farming platform that uses satellite imagery and machine learning to predict crop yields, detect diseases early, and optimise irrigation schedules for small-scale farmers.",
    founder: "Sneha Patel",
    team: ["Sneha Patel (CEO)", "Karan Joshi (ML Lead)", "Amit Verma (Dev)"],
    fundingRequired: 750000,
    fundingReceived: 300000,
    status: "Approved",
    pitchDeck: "AgriNova_PitchDeck.pdf",
    tags: ["AI", "Farming", "SaaS"],
    submittedDate: "2024-12-01",
  },
  {
    id: 3,
    name: "HealthBridge",
    industry: "HealthTech",
    description:
      "Telemedicine platform connecting rural patients with specialist doctors via video consultations, with AI-assisted preliminary diagnosis and digital prescription management.",
    founder: "Dr. Meera Nair",
    team: ["Dr. Meera Nair (CEO)", "Suresh Iyer (CTO)", "Anita Das (CMO)"],
    fundingRequired: 1200000,
    fundingReceived: 0,
    status: "Pending",
    pitchDeck: "HealthBridge_Deck.pdf",
    tags: ["Telemedicine", "Rural Health", "AI"],
    submittedDate: "2025-01-10",
  },
  {
    id: 4,
    name: "FinNest",
    industry: "FinTech",
    description:
      "Micro-investment platform for Gen Z, enabling users to invest spare change from daily transactions into diversified ETF portfolios with as little as ₹10 per transaction.",
    founder: "Rohit Bansal",
    team: ["Rohit Bansal (CEO)", "Neha Singh (CFO)", "Dev Gupta (CTO)"],
    fundingRequired: 500000,
    fundingReceived: 200000,
    status: "Approved",
    pitchDeck: "FinNest_PitchDeck.pdf",
    tags: ["Micro-investment", "Gen Z", "ETF"],
    submittedDate: "2025-01-20",
  },
];

export const getStartupById = (id) => startups.find((s) => s.id === Number(id));
