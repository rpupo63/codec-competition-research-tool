// types/codec.ts
// Request/Response contract for the Codec API
// TODO: This contract maps to the Go Chi backend endpoints

export interface CompetitorReasoning {
  step: string;       // e.g., "Analyzing signal..."
  summary: string;    // e.g., "Checking SEC filings and patent databases for corporate entity match."
  status: 'pending' | 'complete';
}

export interface CompetitorData {
  id: string;
  name: string;
  threat_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  status: string;
  intel: string;
}

export interface CompetitorDrilldown {
  reasoning: CompetitorReasoning[];
  finalAnalysis: string;
  intelLevel: number;
  tokensUsed: number;
  details: {
    marketShare: string;
    keyProducts: string[];
    weaknesses: string[];
    recommendation: string;
  };
}

export interface CompetitorResponse {
  reasoning: CompetitorReasoning[];
  finalAnalysis: string;
  intelLevel: number;
  // TODO: Replace with actual token usage from backend (e.g., response.usage.total_tokens)
  tokensUsed: number;
  competitors?: CompetitorData[];
}

export interface ChatRequest {
  message: string;
  frequency?: string; // codec channel
}

export interface ChatResponse {
  reasoning: CompetitorReasoning[];
  finalAnalysis: string;
  intelLevel: number;
  // TODO: Replace with actual token usage from backend (e.g., response.usage.total_tokens)
  tokensUsed: number;
  competitors?: CompetitorData[];
}
