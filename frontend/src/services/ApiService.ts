export interface ApiChatSession {
  id: string;
  title: string;
  created_at: number; // Unix milliseconds
}

export interface ApiMessage {
  id: string;
  tab_id: string;
  sort_order: number;
  sender: string;
  text: string;
  is_reasoning: boolean;
  reasoning_status: string;
  reasoning_summary: string;
  created_at: number; // Unix milliseconds
}

export interface SessionWithMessagesResponse extends ApiChatSession {
  messages: ApiMessage[];
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ReasoningStep {
  step: string;
  summary: string;
  status: string;
}

export interface CompetitorItem {
  id: string;
  name: string;
  intel: string;
  threat_level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  status: string;
}

import type { DossierMatrixEntry, VulnerabilityEntry, StrikePlanEntry } from "@/types/codec";

export interface IntelDossierResponse {
  classification: string;
  targetCompany: string;
  operationName: string;
  dateCompiled: string;
  matrix: DossierMatrixEntry[];
  vulnerabilities: VulnerabilityEntry[];
  strikePlan: StrikePlanEntry[];
}

export interface ChatResponse {
  reasoning: ReasoningStep[];
  finalAnalysis: string;
  intelLevel: number;
  tokensUsed: number;
  competitors: CompetitorItem[];
  dossier?: IntelDossierResponse;
}

export interface SseEvent {
  type: string;
  step?: string;
  summary?: string;
  status?: string;
  payload?: ChatResponse;
  error?: string;
}

export interface CompetitorDrilldownDetails {
  marketShare: string;
  keyProducts: string[];
  challenges: string[];
  weaknesses: string[];
  recommendation: string;
}

export interface CompetitorDrilldownResponse {
  reasoning: ReasoningStep[];
  finalAnalysis: string;
  intelLevel: number;
  tokensUsed: number;
  details: CompetitorDrilldownDetails;
}

export class SystemFailureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SystemFailureError";
  }
}

export class CompanyNotFoundError extends Error {
  companyName: string;
  constructor(companyName: string) {
    super(`Company not found: ${companyName}`);
    this.name = "CompanyNotFoundError";
    this.companyName = companyName;
  }
}

export class NoCompetitorsError extends Error {
  companyName: string;
  constructor(companyName: string) {
    super(`No competitors found for: ${companyName}`);
    this.name = "NoCompetitorsError";
    this.companyName = companyName;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorDetail = `HTTP error! status: ${response.status}`;
    try {
      const errorBody = await response.json();
      errorDetail = errorBody.message || JSON.stringify(errorBody);

      // Check for specific backend error messages and throw custom errors
      if (response.status === 404 && errorDetail.includes("company not found")) {
        const companyNameMatch = /company '(.*?)' not found/.exec(errorDetail);
        const companyName = companyNameMatch ? companyNameMatch[1] : "unknown";
        throw new CompanyNotFoundError(companyName);
      }
      if (response.status === 204 && errorDetail.includes("no competitors")) {
        const companyNameMatch = /company '(.*?)'/.exec(errorDetail);
        const companyName = companyNameMatch ? companyNameMatch[1] : "unknown";
        throw new NoCompetitorsError(companyName);
      }
    } catch (e) {
      // If errorBody parsing fails or custom error is thrown, re-throw or handle
      if (e instanceof CompanyNotFoundError || e instanceof NoCompetitorsError) {
        throw e;
      }
      errorDetail = response.statusText; // Fallback to status text
    }
    throw new SystemFailureError(
      `API request failed: ${response.status} - ${errorDetail}`,
    );
  }
  if (response.status === 204) {
    return {} as T; // No Content, return an empty object for consistency
  }
  return response.json();
}

export async function listSessions(): Promise<ApiChatSession[]> {
  const response = await fetch(`${API_BASE_URL}/sessions`);
  return handleResponse<ApiChatSession[]>(response);
}

export async function createSession(
  title?: string,
): Promise<ApiChatSession> {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: title || "New Session" }),
  });
  return handleResponse<ApiChatSession>(response);
}

export async function getSession(id: string): Promise<SessionWithMessagesResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/${id}`);
  return handleResponse<SessionWithMessagesResponse>(response);
}

export async function deleteSession(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/sessions/${id}`, {
    method: "DELETE",
  });
  return handleResponse<void>(response);
}

export async function updateSessionTitle(
  id: string,
  title: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/sessions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });
  return handleResponse<void>(response);
}

export async function summarizeSessionTitle(
  id: string,
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/sessions/${id}/summarize`, {
    method: "POST",
  });
  const data = await handleResponse<{ title: string }>(response);
  return data.title;
}

export async function sendMessageStream(
  message: string,
  onStep: (step: string, summary: string, status: string) => void,
  onDone: (response: ChatResponse) => void,
  onError: (error: any) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
  frequency: string | undefined,
  history: ConversationTurn[] | undefined,
  sessionId: string,
  competitorId: string | undefined,
): Promise<void> {
  const body: {
    message: string;
    frequency?: string;
    history?: ConversationTurn[];
    session_id?: string;
    company_identifier?: string;
  } = {
    message,
    session_id: sessionId,
  };
  if (frequency) body.frequency = frequency;
  if (history && history.length > 0) body.history = history;
  if (competitorId) body.company_identifier = competitorId;

  try {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      throw new SystemFailureError(
        `HTTP error! status: ${response.status}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

     
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(line => line.startsWith("data: "));

      for (const line of lines) {
        const jsonStr = line.substring(6); // Remove "data: "
        try {
          const event: SseEvent = JSON.parse(jsonStr);
          switch (event.type) {
            case "step":
              if (event.step && event.summary && event.status) {
                onStep(event.step, event.summary, event.status);
              }
              break;
            case "done":
              if (event.payload) {
                onDone(event.payload);
              }
              break;
            case "error":
              if (event.error) {
                onError(new SystemFailureError(event.error));
              }
              break;
            default:
              console.warn("Unknown SSE event type:", event.type);
          }
        } catch (parseError) {
          console.error("Error parsing SSE JSON:", parseError, "Original line:", line);
          onError(new SystemFailureError(`Error parsing SSE data: ${line}`));
        }
      }
    }
  } catch (error) {
    console.error("Error in sendMessageStream:", error);
    onError(error);
  }
}

export async function fetchCompetitorDrilldown(
  competitorId: string,
): Promise<CompetitorDrilldownResponse> {
  const response = await fetch(`${API_BASE_URL}/competitors/${competitorId}`);
  return handleResponse<CompetitorDrilldownResponse>(response);
}

export interface SessionCompetitorsResponse {
  competitors: CompetitorItem[];
  dossier?: IntelDossierResponse;
}

export async function getSessionCompetitors(
  sessionId: string,
): Promise<SessionCompetitorsResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/competitors`);
  return handleResponse<SessionCompetitorsResponse>(response);
}