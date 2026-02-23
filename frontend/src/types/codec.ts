// types/codec.ts
// Request/Response contract for the Codec API
// TODO: This contract maps to the Go Chi backend endpoints

export interface DossierMatrixEntry {
  name: string;
  threat_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  marketShare: string;
  aiCapability: string;
  keyStrength: string;
  primaryProduct: string;
}

export interface CompetitorReasoning {
  step: string;       // e.g., "Analyzing signal..."
  summary: string;    // e.g., "Checking SEC filings and patent databases for corporate entity match."
  status: 'pending' | 'complete';
}

import type { CompetitorData } from "./common";

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


export interface VulnerabilityEntry {
  competitor: string;
  gaps: string[];
}

export interface StrikePlanEntry {
  codename: string;
  objective: string;
  target: string;
  approach: string;
  timeline: string;
  priority: 'ALPHA' | 'BRAVO' | 'CHARLIE';
}

export interface IntelDossier {
  classification: string;
  targetCompany: string;
  operationName: string;
  dateCompiled: string;
  matrix: DossierMatrixEntry[];
  vulnerabilities: VulnerabilityEntry[];
  strikePlan: StrikePlanEntry[];
}

export interface CompetitorResponse {
  reasoning: CompetitorReasoning[];
  finalAnalysis: string;
  intelLevel: number;
  tokensUsed: number;
  competitors?: CompetitorData[];
  dossier?: IntelDossier;
}

export interface ChatRequest {
  message: string;
  frequency?: string;
}

export interface ChatResponse {
  reasoning: CompetitorReasoning[];
  finalAnalysis: string;
  intelLevel: number;
  tokensUsed: number;
  competitors?: CompetitorData[];
  dossier?: IntelDossier;
}
