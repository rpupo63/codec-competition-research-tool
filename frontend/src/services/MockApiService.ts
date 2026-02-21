// API Service
// Connects to the Go Chi backend at http://localhost:8080

import type { ChatResponse, CompetitorDrilldown } from "@/types/codec";

const BASE_URL = "http://localhost:8080";

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

/**
 * Sends a chat message and returns competitor intelligence.
 * - HTTP 404 → CompanyNotFoundError
 * - HTTP 200 with competitors.length === 0 → NoCompetitorsError
 * - Network error / 5xx → SystemFailureError
 */
export const sendMessage = async (message: string): Promise<ChatResponse> => {
  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  } catch {
    throw new SystemFailureError();
  }

  if (resp.status === 404) {
    throw new CompanyNotFoundError(message);
  }

  if (!resp.ok) {
    throw new SystemFailureError();
  }

  const data: ChatResponse = await resp.json();

  if (data.competitors && data.competitors.length === 0) {
    throw new NoCompetitorsError(message);
  }

  return data;
};

/**
 * Fetches deep-dive intel on a specific competitor.
 * - HTTP 404 / network error → SystemFailureError
 */
export const fetchCompetitorDrilldown = async (competitorId: string): Promise<CompetitorDrilldown> => {
  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/api/competitors/${competitorId}`);
  } catch {
    throw new SystemFailureError();
  }

  if (!resp.ok) {
    throw new SystemFailureError();
  }

  return resp.json();
};

/**
 * @deprecated Use sendMessage instead. Kept for backward compatibility.
 */
export const fetchCompetitorIntel = sendMessage;
