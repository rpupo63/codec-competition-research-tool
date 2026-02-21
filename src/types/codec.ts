// types/codec.ts
// Request/Response contract for the Codec API
// TODO: This contract maps to the Go Chi backend endpoints

export interface CompetitorReasoning {
  step: string;     // e.g., "Analyzing signal..."
  status: 'pending' | 'complete';
}

export interface CompetitorData {
  name: string;
  threat_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  status: string;
  intel: string;
}

export interface CompetitorResponse {
  reasoning: CompetitorReasoning[];
  finalAnalysis: string;
  intelLevel: number; // 0-100 for the memory/progress bar
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
  competitors?: CompetitorData[];
}
