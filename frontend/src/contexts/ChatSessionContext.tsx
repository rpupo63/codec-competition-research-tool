import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import * as ApiService from "@/services/ApiService";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  hasBeenSummarized?: boolean; // New field
}

interface ChatSessionContextType {
  sessions: ChatSession[];
  activeSessionId: string;
  createSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  updateSessionTitle: (id: string, title: string) => void;
  triggerSessionTitleSummarization: (id: string) => Promise<void>; // New function
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const ChatSessionContext = createContext<ChatSessionContextType | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasAttemptedReplacementSessionCreation, setHasAttemptedReplacementSessionCreation] = useState(false);
  const [hasInitiatedFallback, setHasInitiatedFallback] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // On mount: fetch all sessions from backend; create one if none exist
  useEffect(() => {
    if (hasInitiatedFallback) return; // Prevent re-execution after a fallback has occurred

    let cancelled = false;
    (async () => {
      try {
        const apiSessions = await ApiService.listSessions();
        if (cancelled) return;

        let sessionToActivate: ChatSession | null = null;
        let shouldRedirectToSpecificSession = false; // Flag to indicate if a redirect is needed

        // Try to get session ID from URL
        const match = location.pathname.match(/\/operations\/([a-f0-9-]+)/);
        const urlSessionId = match ? match[1] : null;

        if (apiSessions.length === 0) {
          // No sessions exist, create a new one
          const newSession = await ApiService.createSession("New operation");
          if (cancelled) return;
          sessionToActivate = {
            id: newSession.id,
            title: newSession.title,
            createdAt: newSession.created_at,
            hasBeenSummarized: false,
          };
          setSessions([sessionToActivate]);
          shouldRedirectToSpecificSession = true; // Always redirect if a new session is created
        } else {
          const mapped: ChatSession[] = apiSessions.map((s) => ({
            id: s.id,
            title: s.title,
            createdAt: s.created_at,
            hasBeenSummarized: s.title !== "New operation",
          }));
          setSessions(mapped);

          if (urlSessionId) {
            // Check if session ID from URL exists in fetched sessions
            const foundSession = mapped.find((s) => s.id === urlSessionId);
            if (foundSession) {
              sessionToActivate = foundSession;
              // If URL matches an existing session, no need to redirect unless activeSessionId is different.
              // We explicitly don't set shouldRedirectToSpecificSession here to avoid unnecessary navigation.
            } else {
              // URL session ID not found, default to the first session and redirect
              sessionToActivate = mapped[0];
              shouldRedirectToSpecificSession = true;
            }
          } else {
            // No session ID in URL
            if (location.pathname === "/") {
              // If on the root path, default to the first session and redirect
              sessionToActivate = mapped[0];
              shouldRedirectToSpecificSession = true;
            } else if (location.pathname === "/operations") {
              // If on the /operations list page, do not redirect to a specific session.
              // Just ensure a session is active for the sidebar, but don't navigate.
              sessionToActivate = mapped[0]; // Still set the first session as active for context, but no redirect
              shouldRedirectToSpecificSession = false; // Explicitly no redirect
            }
          }
        }

        if (sessionToActivate) {
          setActiveSessionId(sessionToActivate.id); // Always set active session
          if (shouldRedirectToSpecificSession && location.pathname !== `/operations/${sessionToActivate.id}`) {
            navigate(`/operations/${sessionToActivate.id}`);
          }
        }
      } catch (e) {
        console.error("Failed to load sessions:", e);
        setHasInitiatedFallback(true); // Set the flag to prevent re-attempts
        // Fallback: temporary in-memory session so the app still works offline
        const fallbackId = `session-${Date.now()}`;
        const fallbackSession = { id: fallbackId, title: "New operation", createdAt: Date.now(), hasBeenSummarized: false };
        setSessions([fallbackSession]);
        setActiveSessionId(fallbackId);
        navigate(`/operations/${fallbackId}`); // Navigate to the fallback session
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, location.pathname, activeSessionId, hasInitiatedFallback]);

  // If sessions list becomes empty (last one deleted), create a new one
  useEffect(() => {
    if (!isLoading && sessions.length === 0 && !hasAttemptedReplacementSessionCreation) {
      setHasAttemptedReplacementSessionCreation(true); // Mark that an attempt has been made
      void (async () => {
        try {
          const newSession = await ApiService.createSession("New operation");
          const session: ChatSession = {
            id: newSession.id,
            title: newSession.title,
            createdAt: newSession.created_at,
            hasBeenSummarized: false, // Initialize new field
          };
          setSessions([session]);
          setActiveSessionId(session.id);
        } catch (e) {
          console.error("Failed to create replacement session:", e);
          // If creation fails, hasAttemptedReplacementSessionCreation remains true, preventing further attempts
        }
      })();
    }
  }, [sessions.length, isLoading, hasAttemptedReplacementSessionCreation]);

  const createSession = useCallback(async () => {
    try {
      const newSession = await ApiService.createSession("New operation");
      const session: ChatSession = {
        id: newSession.id,
        title: newSession.title,
        createdAt: newSession.created_at,
        hasBeenSummarized: false,
      };
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      navigate(`/operations/${session.id}`);
    } catch (e) {
      console.error("Failed to create session:", e);
    }
  }, [navigate]);

  const switchSession = useCallback((id: string) => {
    setIsLoading(true);
    setActiveSessionId(id);
    navigate(`/operations/${id}`);
  }, [navigate]);

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await ApiService.deleteSession(id);
      } catch (e) {
        console.error("Failed to delete session:", e);
      }
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (id === activeSessionId && next.length > 0) {
          setActiveSessionId(next[0].id);
        }
        return next;
      });
    },
    [activeSessionId],
  );

  const updateSessionTitle = useCallback((id: string, title: string) => {
    setSessions((prev) => {
      const session = prev.find((s) => s.id === id);
      // Only update if the title is actually different, and mark as summarized if it's not the default.
      if (session?.title === title) return prev; 
      void ApiService.updateSessionTitle(id, title).catch((e) =>
        console.error("Failed to update session title:", e),
      );
      return prev.map((s) => (s.id === id ? { ...s, title, hasBeenSummarized: title !== "New operation" } : s));
    });
  }, []);

  const triggerSessionTitleSummarization = useCallback(async (id: string) => {
    setSessions((prevSessions) => {
      const sessionToSummarize = prevSessions.find((s) => s.id === id);
      // Only proceed if the session exists and hasn't been summarized yet
      if (sessionToSummarize && !sessionToSummarize.hasBeenSummarized) {
        // Optimistically update the UI to show a "Summarizing..." message (or similar)
        // Mark as attempted immediately to prevent duplicate calls, regardless of success.
        setSessions((currentSessions) =>
          currentSessions.map((s) =>
            s.id === id ? { ...s, hasBeenSummarized: true } : s // Mark as attempted to prevent immediate retries
          )
        );

        void (async () => {
          try {
            const summarizedTitle = await ApiService.summarizeSessionTitle(id);
            if (summarizedTitle) {
              setSessions((currentSessions) =>
                currentSessions.map((s) =>
                  s.id === id ? { ...s, title: summarizedTitle, hasBeenSummarized: true } : s
                )
              );
              // Also persist to backend
              void ApiService.updateSessionTitle(id, summarizedTitle).catch((e) =>
                console.error("Failed to persist summarized session title:", e),
              );
            }
          } catch (e) {
            console.error("Failed to summarize session title:", e);
            // If summarization fails, the title remains "New operation" or whatever it was.
            // The `hasBeenSummarized` flag was already set to true to prevent retries.
          }
        })();
      }
      return prevSessions; // Return previous sessions for immediate state update
    });
  }, []);

  return (
    <ChatSessionContext.Provider
      value={{
        sessions,
        activeSessionId,
        createSession,
        switchSession,
        deleteSession,
        updateSessionTitle,
        triggerSessionTitleSummarization, // Add new function to context value
        isLoading,
        setIsLoading,
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSession() {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) {
    throw new Error("useChatSession must be used within a ChatSessionProvider");
  }
  return ctx;
}
