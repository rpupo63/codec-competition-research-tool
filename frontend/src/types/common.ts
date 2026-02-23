export interface CompetitorData {
  id: string;
  name: string;
  intel: string;
  threat_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  status: string;
}

export interface MatrixItem {
  category: string;
  score: number;
  description: string;
  aiCapability: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
}

export type ErrorType = 'company_not_found' | 'no_competitors' | 'system_failure';

export interface TabEntry {
  id: string;
  name: string;
  threatLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  loaded: boolean;
  targetCompany: string;
}