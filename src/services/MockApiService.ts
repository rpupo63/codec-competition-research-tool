// Mock API Service
// TODO: Replace all mock functions with real fetch calls to your Go Chi backend
// TODO: Base URL: http://localhost:8080

import type { ChatResponse, CompetitorResponse, CompetitorDrilldown, IntelDossier } from "@/types/codec";

const SIMULATED_DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Rough token estimate: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Custom Error Classes ───────────────────────────────────────────────────

export class CompanyNotFoundError extends Error {
  companyName: string;
  constructor(companyName: string) {
    super("COMPANY_NOT_FOUND");
    this.name = "CompanyNotFoundError";
    this.companyName = companyName;
  }
}

export class NoCompetitorsError extends Error {
  companyName: string;
  constructor(companyName: string) {
    super("NO_COMPETITORS");
    this.name = "NoCompetitorsError";
    this.companyName = companyName;
  }
}

export class SystemFailureError extends Error {
  constructor() {
    super("SYSTEM_FAILURE");
    this.name = "SystemFailureError";
  }
}

// ─── Test Keywords ──────────────────────────────────────────────────────────
// "apple"   → ✅ Success: finds company + 3 competitors
// "phantom" → ❌ Company not found (INTEL-404)
// "kodak"   → ⚠️ Company found but no competitors (INTEL-204)
// "chaos"   → 💥 Total system failure (SYS-500)

// ─── Intel Dossier: Apple ───────────────────────────────────────────────────
// TODO: Replace with data from backend GET /api/dossier/:companyId
const APPLE_DOSSIER: IntelDossier = {
  classification: "TOP SECRET // FOXHOUND EYES ONLY",
  targetCompany: "APPLE INC.",
  operationName: "OPERATION ORCHARD STRIKE",
  dateCompiled: "2026-02-20T00:00:00Z",
  matrix: [
    {
      name: "SAMSUNG ELECTRONICS",
      threat_level: "CRITICAL",
      marketShare: "19.4%",
      keyStrength: "Vertical integration — chips to screens to devices",
      primaryProduct: "Galaxy S25 / Z Fold 6",
      aiCapability: "MODERATE",
    },
    {
      name: "GOOGLE / ALPHABET",
      threat_level: "HIGH",
      marketShare: "3.8% HW / 72% OS",
      keyStrength: "Android ecosystem + Gemini AI platform",
      primaryProduct: "Pixel 10 / Android OS",
      aiCapability: "CRITICAL",
    },
    {
      name: "MICROSOFT CORP",
      threat_level: "HIGH",
      marketShare: "75% Desktop / 23% Cloud",
      keyStrength: "Enterprise dominance + OpenAI partnership",
      primaryProduct: "M365 Copilot / Surface Pro",
      aiCapability: "CRITICAL",
    },
  ],
  vulnerabilities: [
    {
      competitor: "SAMSUNG",
      gaps: [
        "Software ecosystem is fragmented — no unified app store loyalty",
        "Brand perception in premium tier still trails Apple in Western markets",
        "Heavy Android dependency gives Google leverage over their platform",
        "Bixby AI assistant significantly behind Siri and Gemini",
      ],
    },
    {
      competitor: "GOOGLE",
      gaps: [
        "Hardware margins are razor-thin — Pixel is a loss-leader",
        "Privacy scandals erode consumer trust in data-heavy services",
        "Pixel adoption is niche outside US, Japan, India",
        "No wearable or tablet ecosystem to rival Apple Watch + iPad",
      ],
    },
    {
      competitor: "MICROSOFT",
      gaps: [
        "Zero mobile presence — Windows Phone is long dead",
        "Surface hardware is niche with no carrier partnerships",
        "Consumer brand loyalty far below Apple in personal devices",
        "Gaming division (Xbox) has no crossover into productivity",
      ],
    },
  ],
  strikePlan: [
    {
      codename: "SILENT VIPER",
      objective: "Neutralize Samsung's foldable advantage before mainstream adoption",
      target: "SAMSUNG ELECTRONICS",
      approach: "Accelerate iPhone Fold development. Secure exclusive OLED supply contracts to constrain Samsung's own display allocation. Undercut Galaxy Z pricing with carrier subsidies.",
      timeline: "Q3 2026 — Q1 2027",
      priority: "ALPHA",
    },
    {
      codename: "GREY FOX",
      objective: "Counter Google's AI integration before Gemini becomes default",
      target: "GOOGLE / ALPHABET",
      approach: "Deploy Apple Intelligence across all devices with on-device processing as privacy differentiator. Partner with Anthropic or Mistral for frontier model access. Block Gemini default status in Safari.",
      timeline: "Q2 2026 — Q4 2026",
      priority: "ALPHA",
    },
    {
      codename: "PHANTOM PAIN",
      objective: "Defend enterprise Mac market from Copilot + Surface erosion",
      target: "MICROSOFT CORP",
      approach: "Launch Apple Business+ tier with native AI productivity tools. Deepen Xcode + Swift AI coding assistant. Offer enterprise MDM at zero cost to lock in fleet contracts.",
      timeline: "Q4 2026 — Q2 2027",
      priority: "BRAVO",
    },
  ],
};

/**
 * Fetches competitor intel — hardcoded Apple competitors for testing.
 * TODO: Replace with fetch("http://localhost:8080/api/competitors", { method: "POST", ... })
 */
export const fetchCompetitorIntel = async (_query?: string): Promise<CompetitorResponse> => {
  await delay(SIMULATED_DELAY_MS);

  const finalAnalysis =
    "Snake, we've intercepted communications regarding APPLE INC. Three primary hostile operatives have been identified in their sector. Select a target for deep reconnaissance.";

  const reasoning = [
    { step: "Intercepting corporate frequencies...", summary: "Scanning all known corporate communication bands for signals matching 'Apple Inc.' entity identifiers and registered trade names.", status: "complete" as const },
    { step: "Accessing DARPA shadow-net...", summary: "Querying classified industry databases including SEC filings, patent registries, and M&A records to verify corporate structure.", status: "complete" as const },
    { step: "Cross-referencing market intelligence...", summary: "Comparing Apple's product lines, revenue segments, and market positioning against all entities in adjacent sectors to identify direct rivalries.", status: "complete" as const },
    { step: "Compiling target dossiers...", summary: "Aggregating threat assessments, market share data, and strategic postures for each confirmed competitor into actionable briefings.", status: "complete" as const },
  ];

  const totalText = reasoning.map((r) => r.step).join("") + finalAnalysis;

  return {
    reasoning,
    finalAnalysis,
    intelLevel: 64,
    tokensUsed: estimateTokens(totalText),
    competitors: [
      {
        id: "samsung",
        name: "SAMSUNG ELECTRONICS",
        threat_level: "CRITICAL",
        status: "ACTIVE",
        intel: "Primary hardware rival. Dominates global smartphone and semiconductor markets.",
      },
      {
        id: "google",
        name: "GOOGLE / ALPHABET",
        threat_level: "HIGH",
        status: "EXPANDING",
        intel: "Controls Android ecosystem. Expanding into hardware with Pixel line and AI services.",
      },
      {
        id: "microsoft",
        name: "MICROSOFT CORP",
        threat_level: "HIGH",
        status: "ACTIVE",
        intel: "Enterprise dominance. Surface line challenges iPad. Azure competes with iCloud infrastructure.",
      },
    ],
    dossier: APPLE_DOSSIER,
  };
};

/** Drilldown data for each competitor */
const DRILLDOWN_DATA: Record<string, CompetitorDrilldown> = {
  samsung: {
    reasoning: [
      { step: "Accessing Samsung R&D intercepts...", summary: "Pulling patent filings, internal roadmap leaks, and supply chain contracts from Samsung's semiconductor and mobile divisions.", status: "complete" },
      { step: "Analyzing Galaxy product pipeline...", summary: "Mapping the Galaxy S, Z Fold, and A-series release cadence against Apple's iPhone cycle to identify overlap windows.", status: "complete" },
      { step: "Decrypting semiconductor division intel...", summary: "Samsung fabricates chips for competitors including Apple. Analyzing leverage this creates in pricing negotiations and supply constraints.", status: "complete" },
    ],
    finalAnalysis:
      "Snake, Samsung is Apple's most dangerous rival. They control the entire vertical — from chip fabrication to consumer devices. Their Galaxy S series directly contests iPhone market share, and their semiconductor division supplies components to half the industry, including Apple itself. That's a significant leverage point.",
    intelLevel: 91,
    tokensUsed: 0,
    details: {
      marketShare: "19.4% global smartphone market (Q4 2025)",
      keyProducts: ["Galaxy S25 Ultra", "Galaxy Z Fold 6", "Exynos chipsets", "OLED display panels"],
      weaknesses: ["Software ecosystem fragmentation", "Brand perception in premium segment lags Apple", "Heavy reliance on Android ecosystem they don't control"],
      recommendation: "Monitor their foldable strategy closely. If they crack mainstream pricing, it threatens iPad and iPhone simultaneously.",
    },
  },
  google: {
    reasoning: [
      { step: "Tapping into Mountain View signals...", summary: "Monitoring Google's public API changelogs, developer conference announcements, and Chromium commit history for strategic direction.", status: "complete" },
      { step: "Analyzing Pixel hardware trajectory...", summary: "Pixel sales remain niche but serve as reference hardware for Android. Evaluating whether Tensor chips signal a vertical integration play.", status: "complete" },
      { step: "Decrypting AI/ML initiative dossiers...", summary: "Gemini models are being embedded across Search, Workspace, and Android. Assessing how this undermines Apple's Siri and on-device ML strategy.", status: "complete" },
    ],
    finalAnalysis:
      "Snake, Google is playing a long game. They control the OS that powers 72% of the world's smartphones. Their AI capabilities — Gemini, TPU hardware, search dominance — represent an existential threat to Apple's services revenue. The Pixel line is a trojan horse for their AI-first hardware vision.",
    intelLevel: 85,
    tokensUsed: 0,
    details: {
      marketShare: "3.8% smartphone hardware, but 72% mobile OS market via Android",
      keyProducts: ["Pixel 10 Pro", "Gemini AI platform", "Android OS", "Google Cloud / Workspace"],
      weaknesses: ["Hardware margins thin compared to Apple", "Privacy reputation issues", "Pixel adoption still niche outside US"],
      recommendation: "Their AI integration is the real threat. Apple Intelligence must match Gemini capabilities or risk losing the developer ecosystem.",
    },
  },
  microsoft: {
    reasoning: [
      { step: "Infiltrating Redmond data centers...", summary: "Reviewing Azure growth metrics, enterprise adoption rates, and Microsoft 365 engagement data to gauge competitive overlap with Apple's ecosystem.", status: "complete" },
      { step: "Analyzing Surface division performance...", summary: "Surface revenue is flat but the line serves as a halo product for Windows + Copilot. Evaluating threat to MacBook and iPad in enterprise.", status: "complete" },
      { step: "Decrypting Azure cloud expansion plans...", summary: "Microsoft's OpenAI partnership gives them exclusive access to frontier models. Assessing how Copilot integration changes the productivity landscape Apple competes in.", status: "complete" },
    ],
    finalAnalysis:
      "Snake, Microsoft has pivoted from a direct consumer hardware competitor to an enterprise and AI powerhouse. Their Copilot integration across Office 365 threatens Apple's productivity narrative. Azure cloud infrastructure and the OpenAI partnership give them an AI moat that Apple currently lacks.",
    intelLevel: 78,
    tokensUsed: 0,
    details: {
      marketShare: "Enterprise: 75% desktop OS. Cloud: 23% IaaS market. Surface: ~4% tablet market.",
      keyProducts: ["Surface Pro 11", "Microsoft 365 + Copilot", "Azure / OpenAI partnership", "Xbox Game Pass"],
      weaknesses: ["Mobile presence is effectively zero", "Surface hardware still niche", "Consumer brand loyalty far below Apple"],
      recommendation: "The Copilot + Enterprise play is their strongest angle. Watch for enterprise customers switching from Mac to Surface with AI-powered workflows.",
    },
  },
};

/**
 * Fetches deep-dive intel on a specific competitor.
 * TODO: Replace with fetch(`http://localhost:8080/api/competitors/${competitorId}`, { method: "GET" })
 */
export const fetchCompetitorDrilldown = async (competitorId: string): Promise<CompetitorDrilldown> => {
  await delay(1500);

  const data = DRILLDOWN_DATA[competitorId];
  if (!data) {
    throw new SystemFailureError();
  }

  const allText = data.reasoning.map((r) => r.step).join("") + data.finalAnalysis +
    JSON.stringify(data.details);
  data.tokensUsed = estimateTokens(allText);

  return data;
};

/**
 * Sends a general chat message to the Colonel.
 * TODO: Replace with fetch("http://localhost:8080/api/chat", { method: "POST", body: JSON.stringify({ message }), ... })
 *
 * Test keywords:
 *   "apple"   → success with competitors
 *   "phantom" → CompanyNotFoundError
 *   "kodak"   → NoCompetitorsError
 *   "chaos"   → SystemFailureError
 */
export const sendMessage = async (message: string): Promise<ChatResponse> => {
  const lower = message.toLowerCase();

  // ── FAILURE PATH: Total system failure ──
  if (lower.includes("chaos")) {
    await delay(1200);
    throw new SystemFailureError();
  }

  // ── FAILURE PATH: Company not found ──
  if (lower.includes("phantom")) {
    await delay(1500);
    // We still do some "reasoning" before the error
    throw new CompanyNotFoundError("Phantom Corp");
  }

  // ── FAILURE PATH: Company found, no competitors ──
  if (lower.includes("kodak")) {
    await delay(1800);
    throw new NoCompetitorsError("Kodak");
  }

  // ── SUCCESS PATH: Competitor query ──
  const isCompetitorQuery =
    lower.includes("competitor") ||
    lower.includes("rival") ||
    lower.includes("enemy") ||
    lower.includes("threat") ||
    lower.includes("apple");

  if (isCompetitorQuery) {
    return fetchCompetitorIntel(message);
  }

  // ── DEFAULT: General chat ──
  await delay(800);

  const finalAnalysis = `Snake, I read you. "${message}" — that's noted. Stay focused on the mission. If you need intel on competitors, just say the word. We have extensive dossiers ready for your review. Remember, the fate of the mission rests on your shoulders.`;

  const reasoning = [
    { step: "Processing transmission...", summary: "Parsing input for known entity names, industry keywords, and actionable intent to determine the appropriate intelligence pipeline.", status: "complete" as const },
    { step: "Verifying clearance level...", summary: "Confirming operator has sufficient access level for the requested data classification. General queries require LEVEL-2 clearance.", status: "complete" as const },
  ];

  const totalText = reasoning.map((r) => r.step).join("") + finalAnalysis;

  return {
    reasoning,
    finalAnalysis,
    intelLevel: 42,
    tokensUsed: estimateTokens(totalText),
  };
};
