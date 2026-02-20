// TODO: Replace with actual backend endpoint

export interface CompetitorData {
  name: string;
  threat_level: string;
  status: string;
  intel: string;
}

export interface ApiResponse {
  reasoning_steps: string[];
  response: string;
  competitors?: CompetitorData[];
}

const COLONEL_RESPONSES: Record<string, ApiResponse> = {
  competitors: {
    reasoning_steps: [
      "Analyzing signal...",
      "Triangulating market position...",
      "Accessing black site data...",
      "Cross-referencing field intelligence...",
      "Decrypting classified dossiers...",
    ],
    response:
      "Snake, listen carefully. We've identified several hostile operatives in the AO. Each one represents a significant threat to our mission objectives. I'm transmitting the dossiers now. Study them carefully — knowing your enemy is half the battle.",
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
  },
};

function getDefaultResponse(message: string): ApiResponse {
  return {
    reasoning_steps: [
      "Processing transmission...",
      "Verifying clearance level...",
    ],
    response: `Snake, I read you. "${message}" — that's noted. Stay focused on the mission. If you need intel on competitors, just say the word. We have extensive dossiers ready for your review. Remember, the fate of the mission rests on your shoulders.`,
  };
}

export async function postCompetitors(): Promise<ApiResponse> {
  // TODO: Replace with actual backend endpoint
  // POST /api/competitors
  await delay(500);
  return COLONEL_RESPONSES.competitors;
}

export async function sendMessage(message: string): Promise<ApiResponse> {
  // TODO: Replace with actual backend endpoint
  // POST /api/chat
  await delay(300);

  const lower = message.toLowerCase();
  if (lower.includes("competitor") || lower.includes("rivals") || lower.includes("enemy") || lower.includes("threats")) {
    return postCompetitors();
  }

  return getDefaultResponse(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
