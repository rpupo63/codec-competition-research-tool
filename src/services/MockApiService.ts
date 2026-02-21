// Mock API Service
// TODO: Replace all mock functions with real fetch calls to your Go Chi backend
// TODO: Base URL: http://localhost:8080

import type { ChatResponse, CompetitorResponse, CompetitorDrilldown } from "@/types/codec";

const SIMULATED_DELAY_MS = 2000;

// Simulate random failure (10% chance) to test error states
const FAILURE_RATE = 0.1;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maybeThrow(): void {
  if (Math.random() < FAILURE_RATE) {
    throw new Error("SIGNAL_LOST");
  }
}

/** Rough token estimate: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Fetches competitor intel — hardcoded Apple competitors for testing.
 * TODO: Replace with fetch("http://localhost:8080/api/competitors", { method: "POST", ... })
 */
export const fetchCompetitorIntel = async (_query?: string): Promise<CompetitorResponse> => {
  await delay(SIMULATED_DELAY_MS);
  maybeThrow();

  const finalAnalysis =
    "Snake, we've intercepted communications regarding APPLE INC. Three primary hostile operatives have been identified in their sector. Select a target for deep reconnaissance.";

  const reasoning = [
    { step: "Intercepting corporate frequencies...", status: "complete" as const },
    { step: "Accessing DARPA shadow-net...", status: "complete" as const },
    { step: "Cross-referencing market intelligence...", status: "complete" as const },
    { step: "Compiling target dossiers...", status: "complete" as const },
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
  };
};

/** Drilldown data for each competitor */
const DRILLDOWN_DATA: Record<string, CompetitorDrilldown> = {
  samsung: {
    reasoning: [
      { step: "Accessing Samsung R&D intercepts...", status: "complete" },
      { step: "Analyzing Galaxy product pipeline...", status: "complete" },
      { step: "Decrypting semiconductor division intel...", status: "complete" },
    ],
    finalAnalysis:
      "Snake, Samsung is Apple's most dangerous rival. They control the entire vertical — from chip fabrication to consumer devices. Their Galaxy S series directly contests iPhone market share, and their semiconductor division supplies components to half the industry, including Apple itself. That's a significant leverage point.",
    intelLevel: 91,
    tokensUsed: 0, // will be calculated
    details: {
      marketShare: "19.4% global smartphone market (Q4 2025)",
      keyProducts: ["Galaxy S25 Ultra", "Galaxy Z Fold 6", "Exynos chipsets", "OLED display panels"],
      weaknesses: ["Software ecosystem fragmentation", "Brand perception in premium segment lags Apple", "Heavy reliance on Android ecosystem they don't control"],
      recommendation: "Monitor their foldable strategy closely. If they crack mainstream pricing, it threatens iPad and iPhone simultaneously.",
    },
  },
  google: {
    reasoning: [
      { step: "Tapping into Mountain View signals...", status: "complete" },
      { step: "Analyzing Pixel hardware trajectory...", status: "complete" },
      { step: "Decrypting AI/ML initiative dossiers...", status: "complete" },
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
      { step: "Infiltrating Redmond data centers...", status: "complete" },
      { step: "Analyzing Surface division performance...", status: "complete" },
      { step: "Decrypting Azure cloud expansion plans...", status: "complete" },
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
  maybeThrow();

  const data = DRILLDOWN_DATA[competitorId];
  if (!data) {
    throw new Error("SIGNAL_LOST");
  }

  // Calculate tokens
  const allText = data.reasoning.map((r) => r.step).join("") + data.finalAnalysis +
    JSON.stringify(data.details);
  data.tokensUsed = estimateTokens(allText);

  return data;
};

/**
 * Sends a general chat message to the Colonel.
 * TODO: Replace with fetch("http://localhost:8080/api/chat", { method: "POST", body: JSON.stringify({ message }), ... })
 */
export const sendMessage = async (message: string): Promise<ChatResponse> => {
  await delay(800);
  maybeThrow();

  const lower = message.toLowerCase();
  const isCompetitorQuery =
    lower.includes("competitor") ||
    lower.includes("rival") ||
    lower.includes("enemy") ||
    lower.includes("threat") ||
    lower.includes("apple");

  if (isCompetitorQuery) {
    return fetchCompetitorIntel(message);
  }

  const finalAnalysis = `Snake, I read you. "${message}" — that's noted. Stay focused on the mission. If you need intel on competitors, just say the word. We have extensive dossiers ready for your review. Remember, the fate of the mission rests on your shoulders.`;

  const reasoning = [
    { step: "Processing transmission...", status: "complete" as const },
    { step: "Verifying clearance level...", status: "complete" as const },
  ];

  const totalText = reasoning.map((r) => r.step).join("") + finalAnalysis;

  return {
    reasoning,
    finalAnalysis,
    intelLevel: 42,
    tokensUsed: estimateTokens(totalText),
  };
};
