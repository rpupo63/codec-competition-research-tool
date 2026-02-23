// types/report.ts
// Request/Response contract for the Competitor Analysis Report API
// TODO: This contract maps to the Go Chi backend endpoints

export interface CompetitorReasoning {
  step: string;       // e.g., "Analyzing signal..."
  summary: string;    // e.g., "Checking SEC filings and patent databases for corporate entity match."
  status: 'pending' | 'complete';
}


export interface CompetitorDrilldown {
  reasoning: CompetitorReasoning[];
  finalAnalysis: string;
  intelLevel: number;
  tokensUsed: number;
  details: {
    marketShare: string;
    keyProducts: string[];
    challenges: string[];
    recommendation: string;
  };
}

export interface DossierMatrixEntry {
  name: string;
  threat_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  marketShare: string;
  keyStrength: string;
  primaryProduct: string;
  aiCapability: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

export interface ChallengeEntry {
  competitor: string;
  gaps: string[];
}

export interface StrategicRecommendationEntry {
  codename: string;
  objective: string;
  target: string;
  approach: string;
  timeline: string;
  priority: 'ALPHA' | 'BRAVO' | 'CHARLIE';
}

export interface CompetitorAnalysisReport {
  classification: string;
  targetCompany: string;
  operationName: string;
  dateCompiled: string;
  matrix: DossierMatrixEntry[];
  challenges: ChallengeEntry[];
  strikePlan: StrategicRecommendationEntry[];
}


