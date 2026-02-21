// Mock API Service
// TODO: Replace all mock functions with real fetch calls to your Go Chi backend
// TODO: Base URL: http://localhost:8080

import type { ChatResponse, CompetitorResponse } from "@/types/codec";

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
 * Fetches competitor intel from the briefing system.
 * TODO: Replace with fetch("http://localhost:8080/api/competitors", { method: "POST", ... })
 * TODO: Use response.usage.total_tokens for real token count
 */
export const fetchCompetitorIntel = async (_query?: string): Promise<CompetitorResponse> => {
  await delay(SIMULATED_DELAY_MS);
  maybeThrow();

  const finalAnalysis =
    "Snake, listen carefully. We've identified several hostile operatives in the AO. Each one represents a significant threat to our mission objectives. I'm transmitting the dossiers now. Study them carefully — knowing your enemy is half the battle.";

  const reasoning = [
    { step: "Triangulating rival frequencies...", status: "complete" as const },
    { step: "Accessing DARPA shadow-net...", status: "complete" as const },
    { step: "Cross-referencing field intelligence...", status: "complete" as const },
    { step: "Decrypting classified dossiers...", status: "complete" as const },
  ];

  const totalText = reasoning.map((r) => r.step).join("") + finalAnalysis;

  return {
    reasoning,
    finalAnalysis,
    // TODO: Replace with actual backend memory/context usage metric
    intelLevel: 87,
    // TODO: Replace with response.usage.total_tokens from backend
    tokensUsed: estimateTokens(totalText),
    competitors: [
      {
        name: "SHADOW TECH INC.",
        threat_level: "HIGH",
        status: "ACTIVE",
        intel: "Primary competitor. Advanced R&D capabilities. Known for aggressive market tactics.",
      },
      {
        name: "CIPHER DYNAMICS",
        threat_level: "MODERATE",
        status: "ACTIVE",
        intel: "Specializes in encryption and security. Growing market share in Eastern sectors.",
      },
      {
        name: "OUTER HAVEN CORP",
        threat_level: "CRITICAL",
        status: "EXPANDING",
        intel: "Recently acquired three subsidiaries. Massive resource pool. Do not underestimate.",
      },
    ],
  };
};

/**
 * Sends a general chat message to the Colonel.
 * TODO: Replace with fetch("http://localhost:8080/api/chat", { method: "POST", body: JSON.stringify({ message }), ... })
 * TODO: Use response.usage.total_tokens for real token count
 */
export const sendMessage = async (message: string): Promise<ChatResponse> => {
  await delay(800);
  maybeThrow();

  const lower = message.toLowerCase();
  const isCompetitorQuery =
    lower.includes("competitor") ||
    lower.includes("rival") ||
    lower.includes("enemy") ||
    lower.includes("threat");

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
    // TODO: Replace with actual backend memory/context usage metric
    intelLevel: 42,
    // TODO: Replace with response.usage.total_tokens from backend
    tokensUsed: estimateTokens(totalText),
  };
};
