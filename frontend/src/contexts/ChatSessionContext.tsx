import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
}

interface ChatSessionContextType {
  sessions: ChatSession[];
  activeSessionId: string;
  createSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  updateSessionTitle: (id: string, title: string) => void;
}

const ChatSessionContext = createContext<ChatSessionContextType | null>(null);

function generateId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeSession(): ChatSession {
  return { id: generateId(), title: "New operation", createdAt: Date.now() };
}

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const initial = makeSession();
    return [initial];
  });
  const [activeSessionId, setActiveSessionId] = useState(
    () => sessions[0].id,
  );

  const createSession = useCallback(() => {
    const session = makeSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (next.length === 0) {
          const fresh = makeSession();
          setActiveSessionId(fresh.id);
          return [fresh];
        }
        if (id === activeSessionId) {
          setActiveSessionId(next[0].id);
        }
        return next;
      });
    },
    [activeSessionId],
  );

  const updateSessionTitle = useCallback((id: string, title: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s)),
    );
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
