import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "react-router-dom"; // Import useParams
import PortraitFrame from "@/components/shared/PortraitFrame";
import FrequencyDisplay from "@/components/shared/FrequencyDisplay";
import ChatMessage from "@/components/shared/ChatMessage";
import ErrorDialog from "@/components/shared/ErrorDialog";
import CompetitorPicker from "@/components/shared/CompetitorPicker";
import CompanyConfirmation from "@/components/shared/CompanyConfirmation";
import DossierPanel from "@/components/shared/DossierPanel";
import DossierTabs from "@/components/shared/DossierTabs";
import * as ApiService from "@/services/ApiService";
import {
  CompanyNotFoundError,
  NoCompetitorsError,
  SystemFailureError,
} from "@/services/ApiService";
import type { ConversationTurn } from "@/services/ApiService";
import type { CompetitorDrilldown, IntelDossier, ChatResponse } from "@/types/codec";
import type { CompetitorData, ErrorType } from "@/types/common";
import {
  downloadTextFile,
  generateConversationSummary,
  generateDossierReport,
} from "@/lib/download";
import { mapThreatLevelToString } from "@/lib/utils";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { useChatSession } from "@/contexts/ChatSessionContext"; // Import useChatSession
import colonelImg from "@/assets/colonel.png";
import snakeImg from "@/assets/snake.png";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Message {
  id: number;
  sender: string;
  text: string;
  isReasoning?: boolean;
  reasoningStatus?: "pending" | "complete";
  reasoningSummary?: string;
}


const INITIAL_MESSAGE: Message = {
  id: 0,
  sender: "COLONEL",
  text: "Snake, do you read me? This is a secure channel. I'll be your support for this operation. If you need intel on competitors, just ask. Stay sharp out there.",
};

// Stub drilldown: marks a competitor tab as "already loaded" (suppresses re-fetch)
const DRILLDOWN_STUB: CompetitorDrilldown = {
  reasoning: [],
  finalAnalysis: "",
  intelLevel: 0,
  tokensUsed: 0,
  details: { marketShare: "", keyProducts: [], weaknesses: [], recommendation: "" },
};



interface CompetitorTabInfo {
  id: string;
  name: string;
  threatLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  competitor: CompetitorData;
  targetCompany: string;
  drilldown?: CompetitorDrilldown;
}

const CodecScreen = () => {
  const { sessionId: sessionIdFromParams } = useParams<{ sessionId: string }>();
  const sessionId = sessionIdFromParams || ""; // Ensure sessionId is always a string

  const { sessions, activeSessionId, triggerSessionTitleSummarization, isLoading, setIsLoading } = useChatSession();

  const [isLoadingSession, setIsLoadingSession] = useState(true); // Local loading state for this component's data fetching

  const currentSession = sessions.find((s) => s.id === activeSessionId);

  const hasFiredFirstMessage = useRef(false);
  const [activeTab, setActiveTab] = useState("main");
  const [competitorTabs, setCompetitorTabs] = useState<CompetitorTabInfo[]>([]);
  const [messagesByTab, setMessagesByTab] = useState<Record<string, Message[]>>({
    main: [INITIAL_MESSAGE],
  });

  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [colonelSpeaking, setColonelSpeaking] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [activeNewId, setActiveNewId] = useState<number | null>(null);
  const [selectableCompetitors, setSelectableCompetitors] = useState<CompetitorData[] | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<{ userInput: string; response?: ChatResponse | null } | null>(null);
  const [isConfirmationPending, setIsConfirmationPending] = useState(false);
  const [bufferedMessages, setBufferedMessages] = useState<Message[]>([]);

  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [errorCompanyName, setErrorCompanyName] = useState<string | undefined>(undefined);


  const [dossierData, setDossierData] = useState<IntelDossier | null>(null);
  const [dossierVisible, setDossierVisible] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingStepMessageIds = useRef<Map<string, number>>(new Map());

    const addMessage = useCallback((tabId: string, msg: Omit<Message, "id">) => {
      const id = nextId.current++;
      const newMessage = { ...msg, id };
  
      // If confirmation is pending, buffer messages for the main tab.
      // Other tabs can still receive messages normally.
      if (tabId === "main" && isConfirmationPending) {
        setBufferedMessages((prev) => [...prev, newMessage]);
      } else {
        setMessagesByTab((prev) => ({
          ...prev,
          [tabId]: [...(prev[tabId] || []), newMessage],
        }));
      }
      setActiveNewId(id);
      return newMessage; // Return the full message object
    }, [isConfirmationPending]); // Corrected dependencies
  const processFinalResponse = useCallback((response: ChatResponse, inputTabId: string) => {
      setIsThinking(false);
      setTokenCount((prev) => prev + response.tokensUsed);
      setMemoryUsage(response.intelLevel);
      setColonelSpeaking(true);
      addMessage(inputTabId, { sender: "COLONEL", text: response.finalAnalysis });

      if (currentSession && currentSession.title === "New operation" && !currentSession.hasBeenSummarized) {
        void triggerSessionTitleSummarization(currentSession.id);
      }

      if (inputTabId === "main") {
        if (response.competitors && response.competitors.length > 0) {
          const targetCompany = response.dossier?.targetCompany || "UNKNOWN";

          for (const comp of response.competitors) {
            addMessage("main", {
              sender: "INTEL",
              text: `[${comp.threat_level}] ${comp.name} — ${comp.intel}`,
            });
          }

          setCompetitorTabs((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newTabs = response.competitors!
              .filter((comp) => !existingIds.has(comp.id))
              .map((comp) => ({
                id: comp.id,
                name: comp.name,
                threatLevel: comp.threat_level,
                competitor: comp,
                targetCompany,
              }));
            return newTabs.length > 0 ? [...prev, ...newTabs] : prev;
          });

          setMessagesByTab((prev) => {
            const updated = { ...prev };
            let changed = false;
            for (const comp of response.competitors!) {
              if (!updated[comp.id]) {
                updated[comp.id] = [];
                changed = true;
              }
            }
            return changed ? updated : prev;
          });

          setSelectableCompetitors(response.competitors);
        }

        if (response.dossier) {
          setDossierData({
            classification: response.dossier.classification,
            targetCompany: response.dossier.targetCompany,
            operationName: response.dossier.operationName,
            dateCompiled: response.dossier.dateCompiled,
            matrix: response.dossier.matrix as IntelDossier["matrix"],
            vulnerabilities: response.dossier.vulnerabilities || [],
            strikePlan: response.dossier.strikePlan as IntelDossier["strikePlan"],
          });
        }
      }
    }, [addMessage, currentSession, triggerSessionTitleSummarization, setCompetitorTabs, setMessagesByTab, setSelectableCompetitors, setDossierData, setIsThinking, setTokenCount, setMemoryUsage, setColonelSpeaking]);




  const isAiActive = isProcessing || isThinking || colonelSpeaking || activeNewId !== null;
  //const { play, stop } = useAudioPlayback("/mother.wav");

  const currentMessages = useMemo(() => messagesByTab[activeTab] || [], [messagesByTab, activeTab]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [bottomRef]);

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, selectableCompetitors, activeTab, scrollToBottom]);

  // Load session history when sessionId is a real backend UUID
  useEffect(() => {
    if (!UUID_REGEX.test(sessionId)) {
      setIsLoadingSession(false); // Explicitly set to false if sessionId is invalid
      return;
    }

    setIsLoadingSession(true); // Start loading
    let cancelled = false;
    (async () => {
      try {
        const [sessionData, competitorsData] = await Promise.all([
          ApiService.getSession(sessionId),
          ApiService.getSessionCompetitors(sessionId),
        ]);
        if (cancelled) {
          return;
        }
        if (cancelled) return;

        // Group messages by tab_id
        const grouped: Record<string, Message[]> = {};
        let maxSortOrder = 0;
        for (const msg of sessionData.messages) {
          const tabId = msg.tab_id || "main";
          if (!grouped[tabId]) grouped[tabId] = [];
          grouped[tabId].push({
            id: msg.sort_order,
            sender: msg.sender,
            text: msg.text,
            isReasoning: msg.is_reasoning,
            reasoningStatus: (msg.reasoning_status || undefined) as
              | "pending"
              | "complete"
              | undefined,
            reasoningSummary: msg.reasoning_summary || undefined,
          });
          if (msg.sort_order > maxSortOrder) maxSortOrder = msg.sort_order;
        }

        nextId.current = maxSortOrder + 1;

        // If main tab has no persisted messages, show the initial greeting
        if (!grouped.main || grouped.main.length === 0) {
          grouped.main = [INITIAL_MESSAGE];
          hasFiredFirstMessage.current = false; // New session, first message not fired
        } else {
          hasFiredFirstMessage.current = true; // Existing session with messages, first message already fired
        }

        // Recreate competitor tabs; mark those with existing messages as already-loaded
        const tabs: CompetitorTabInfo[] = (competitorsData.competitors || []).map((comp) => ({
          id: comp.id,
          name: comp.name,
          threatLevel: comp.threat_level,
          competitor: comp,
          targetCompany: competitorsData.dossier?.targetCompany || "UNKNOWN",
          drilldown:
            grouped[comp.id] && grouped[comp.id].length > 0 ? DRILLDOWN_STUB : undefined,
        }));

        setCompetitorTabs(tabs);
        setMessagesByTab(grouped);

        // Restore dossier (challenges → vulnerabilities rename)
        if (competitorsData.dossier) {
          setDossierData({
            classification: competitorsData.dossier.classification,
            targetCompany: competitorsData.dossier.targetCompany,
            operationName: competitorsData.dossier.operationName,
            dateCompiled: competitorsData.dossier.dateCompiled,
            matrix: competitorsData.dossier.matrix as IntelDossier["matrix"],
            vulnerabilities: (competitorsData.dossier.vulnerabilities || []) as IntelDossier["vulnerabilities"],
            strikePlan: competitorsData.dossier.strikePlan as IntelDossier["strikePlan"],
          });
        }
      } catch (e) {
        console.error("Failed to load session history for:", sessionId, e);
        // Depending on desired UX, you might want to show an error message
        // and potentially navigate away or keep loading state for retry.
      } finally {
        if (!cancelled) {
          setIsLoadingSession(false); // End loading
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);



  const updateReasoningStatus = useCallback(
    (tabId: string, msgId: number, status: "pending" | "complete") => {
      setMessagesByTab((prev) => ({
        ...prev,
        [tabId]: (prev[tabId] || []).map((m) =>
          m.id === msgId ? { ...m, reasoningStatus: status } : m,
        ),
      }));
    },
    [],
  );

  const updateMessageContent = useCallback(
    (
      tabId: string,
      msgId: number,
      newText: string,
      newSummary: string | undefined,
      newReasoningStatus: "pending" | "complete" | undefined,
    ) => {
      // Check if the message is in bufferedMessages
      if (tabId === "main" && isConfirmationPending) {
        setBufferedMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  text: newText,
                  reasoningSummary: newSummary,
                  reasoningStatus: newReasoningStatus,
                }
              : m,
          ),
        );
      } else {
        setMessagesByTab((prev) => ({
          ...prev,
          [tabId]: (prev[tabId] || []).map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  text: newText,
                  reasoningSummary: newSummary,
                  reasoningStatus: newReasoningStatus,
                }
              : m,
          ),
        }));
      }
    },
    [isConfirmationPending], // Add isConfirmationPending to dependencies
  );

    const handleError = useCallback((error: unknown, tabId: string = "main") => {
      setIsThinking(false);
      setIsProcessing(false);
      setIsConfirming(false);
      // Clear any pending step messages on error
      pendingStepMessageIds.current.clear();
  
      if (error instanceof CompanyNotFoundError) {
        setErrorType("company_not_found");
        setErrorCompanyName(error.companyName);
        setErrorDialogVisible(true);
        addMessage(tabId, {
          sender: "SYSTEM",
          text: `⊘ INTEL-404: No records found for "${error.companyName.toUpperCase()}".`,
          isReasoning: true,
          reasoningStatus: "complete",
        });
      } else if (error instanceof NoCompetitorsError) {
        setErrorType("no_competitors");
        setErrorCompanyName(error.companyName);
        setErrorDialogVisible(true);
        addMessage(tabId, {
          sender: "SYSTEM",
          text: `◇ INTEL-204: "${error.companyName.toUpperCase()}" located, but no active competitors detected.`,
          isReasoning: true,
          reasoningStatus: "complete",
        });
      } else if (error instanceof SystemFailureError) {
        setErrorType("system_failure");
        setErrorCompanyName(undefined);
        setErrorDialogVisible(true);
        addMessage(tabId, {
          sender: "SYSTEM",
          text: "⚠ SYS-500: Critical system failure. All intelligence nodes offline.",
          isReasoning: true,
          reasoningStatus: "complete",
        });
      } else {
        setErrorType("system_failure");
        setErrorDialogVisible(true);
      }
    }, [addMessage]);
  
    const executeResearch = useCallback(async (tabId: string, userMessage: string, history: ConversationTurn[], isInitialQuery: boolean) => {
      setIsProcessing(true);
      setIsThinking(true);
      setSelectableCompetitors(null);
      pendingStepMessageIds.current.clear();
  
      try {
        await ApiService.sendMessageStream(
          userMessage,
          (event) => { // onStep now receives the full SseEvent
            if (event.type === "company_resolved" && isInitialQuery && event.payload) {
              const companyPayload = event.payload as CompanyResolvedPayload; // Type narrowing
              setPendingConfirmation({ userInput: userMessage, response: { dossier: { targetCompany: companyPayload.resolvedName } } as ChatResponse });
              setIsConfirmationPending(true);
              return; // Stop processing further steps until confirmed
            }

            if (event.type === "step") {
              const { step, summary, status } = event;
              if (!step || !summary || !status) return; // Should not happen with valid step events

              if (status === "pending") {
                const messageId = pendingStepMessageIds.current.get(step);
                if (messageId) {
                  updateMessageContent(tabId, messageId, step, summary, "pending");
                } else {
                  const newMessage = addMessage(tabId, {
                    sender: "SYSTEM",
                    text: step,
                    isReasoning: true,
                    reasoningStatus: "pending",
                    reasoningSummary: summary,
                  });
                  pendingStepMessageIds.current.set(step, newMessage.id);
                }
              } else if (status === "complete") {
                const messageId = pendingStepMessageIds.current.get(step);
                if (messageId !== undefined) {
                  updateMessageContent(tabId, messageId, step, summary, "complete");
                  pendingStepMessageIds.current.delete(step);
                }
              }
            }
          },
          (response) => { // onDone
            pendingStepMessageIds.current.clear();

            if (isInitialQuery && response.dossier?.targetCompany) {
              setPendingConfirmation({ userInput: userMessage, response: response });
              // Do NOT call processFinalResponse yet
            } else {
              processFinalResponse(response, tabId);
            }
            setIsProcessing(false);
            setIsConfirming(false); // End confirmation process
          },
          (error) => { // onError
            handleError(error, tabId);
            setIsConfirming(false); // End confirmation process
          },
          undefined,
          history,
          sessionId,
          tabId !== "main" ? tabId : undefined,
        );
      } catch (error) {
        handleError(error, tabId);
        setIsConfirming(false); // End confirmation process
      }
    }, [sessionId, addMessage, handleError, processFinalResponse, updateMessageContent]);
  
  
    const handleConfirmCompany = useCallback(async () => {
      if (!pendingConfirmation) return;

      const { userInput, response: chatResponse } = pendingConfirmation;
      if (!chatResponse) return;

      setIsConfirming(true);
      setIsConfirmationPending(false); // Confirmation is no longer pending
      setPendingConfirmation(null); // Clear confirmation UI

      // Add buffered messages to the main chat
      setMessagesByTab((prev) => ({
        ...prev,
        main: [...(prev.main || []), ...bufferedMessages],
      }));
      setBufferedMessages([]); // Clear buffered messages

      // Now process the final response
      processFinalResponse(chatResponse, "main");
      setIsProcessing(false);
      setIsThinking(false);
      setTimeout(() => setColonelSpeaking(false), 2000);
    }, [pendingConfirmation, processFinalResponse, bufferedMessages]);
  
    const handleAbortCompany = useCallback(() => {
      if (!pendingConfirmation) return;
      
      addMessage("main", {
        sender: "COLONEL",
        text: "Mission aborted. Target unconfirmed. Re-enter company to try again.",
      });
      setPendingConfirmation(null);
      setIsConfirmationPending(false); // Confirmation is no longer pending
      setBufferedMessages([]); // Clear buffered messages
      setIsProcessing(false);
      setIsThinking(false);
      setIsConfirming(false);
    }, [addMessage, pendingConfirmation]);
  
    const processMessageOnTab = useCallback(async (tabId: string, userMessage: string) => {
      const history: ConversationTurn[] = (messagesByTab[tabId] || [])
        .filter(msg => msg.id !== 0 && !msg.isReasoning && msg.sender !== "INTEL" && msg.sender !== "SYSTEM")
        .map(msg => ({
          role: msg.sender === "SNAKE" ? "user" as const : "assistant" as const,
          content: msg.text,
        }));
  
      const isInitialQuery = tabId === "main" && !hasFiredFirstMessage.current;

      // Always execute research, the confirmation will be handled in onDone of sendMessageStream
      await executeResearch(tabId, userMessage, history, isInitialQuery);
      if (isInitialQuery) {
        hasFiredFirstMessage.current = true; // Mark that the first message has been fired
      }
    }, [messagesByTab, executeResearch]);
  
    const loadCompetitorDrilldown = useCallback(async (tabId: string) => {
      const tab = competitorTabs.find((t) => t.id === tabId);
      if (!tab || tab.drilldown) return;
  
    addMessage(tabId, {
      sender: "SNAKE",
      text: `Colonel, give me everything on ${tab.name}.`,
    });
    setIsProcessing(true);
    setIsThinking(true);
    pendingStepMessageIds.current.clear(); // Clear pending steps for a new drilldown

    try {
      const drilldown = await ApiService.fetchCompetitorDrilldown(tab.id);

      // Show reasoning steps (one at a time, updating the current reasoning message)
      for (const step of drilldown.reasoning) {
        let messageId = pendingStepMessageIds.current.get(step.step);
        if (messageId) {
          updateMessageContent(
            tabId,
            messageId,
            step.step,
            step.summary,
            step.status as "pending" | "complete",
          );
        } else {
          const newMessage = addMessage(tabId, {
            sender: "SYSTEM",
            text: step.step,
            isReasoning: true,
            reasoningStatus: step.status as "pending" | "complete",
            reasoningSummary: step.summary,
          });
          messageId = newMessage.id;
          pendingStepMessageIds.current.set(step.step, messageId);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        // Mark as complete after delay
        updateMessageContent(tabId, messageId, step.step, step.summary, "complete");
        pendingStepMessageIds.current.delete(step.step);
      }

      // Show the initial summary of findings as a COLONEL message
      setColonelSpeaking(true);
      addMessage(tabId, { sender: "COLONEL", text: drilldown.finalAnalysis });

      // Mark the tab as loaded so it's won't re-fetch on revisit
      setCompetitorTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                drilldown: {
                  reasoning: drilldown.reasoning.map(r => ({
                    step: r.step,
                    summary: r.summary,
                    status: r.status as 'pending' | 'complete',
                  })),
                  finalAnalysis: drilldown.finalAnalysis,
                  intelLevel: drilldown.intelLevel,
                  tokensUsed: drilldown.tokensUsed,
                  details: {
                    marketShare: drilldown.details.marketShare,
                    keyProducts: drilldown.details.keyProducts || [],
                    weaknesses: drilldown.details.weaknesses || [],
                    recommendation: drilldown.details.recommendation,
                  },
                },
              }
            : t,
        ),
      );
    } catch (error) {
      handleError(error, tabId);
    } finally {
      setIsProcessing(false);
      setIsThinking(false);
      setTimeout(() => setColonelSpeaking(false), 2000);
    }
  }, [addMessage, competitorTabs, handleError, setCompetitorTabs, updateMessageContent]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId !== "main" && !isProcessing) {
      const tab = competitorTabs.find((t) => t.id === tabId);
      if (tab && !tab.drilldown) {
        //play();
        void loadCompetitorDrilldown(tabId);
      }
    }
  };

  const handleCompetitorSelect = (competitor: CompetitorData) => {
    //play();
    handleTabChange(competitor.id);
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const userMessage = input.trim();
    setInput("");
    setSelectableCompetitors(null);


    addMessage(activeTab, { sender: "SNAKE", text: userMessage });
    await processMessageOnTab(activeTab, userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  const handleDownloadSummary = () => {
    const tab = competitorTabs.find((t) => t.id === activeTab);
    if (!tab) return;
    const msgs = messagesByTab[activeTab] || [];
    const content = generateConversationSummary(tab.competitor, msgs, tab.drilldown);
    const safeName = tab.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    downloadTextFile(content, `intel-${safeName}.txt`);
  };

  const handleDownloadDossier = () => {
    if (!dossierData) return;
    const content = generateDossierReport(dossierData);
    const safeName = dossierData.operationName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    downloadTextFile(content, `dossier-${safeName}.txt`);
  };

  const showTabBar = competitorTabs.length > 0;
  const unexploredCompetitors = selectableCompetitors?.filter(
    (comp) => !competitorTabs.some((t) => t.id === comp.id && t.drilldown),
  );

  return (
    <div className="flex flex-col h-svh bg-background overflow-hidden relative">
      <ErrorDialog
        visible={errorDialogVisible}
        errorType={errorType}
        companyName={errorCompanyName}
        onDismiss={() => setErrorDialogVisible(false)}
        variant="codec"
      />
      {dossierData && currentSession && currentSession.title !== "New operation" && (
        <DossierPanel
          dossier={dossierData}
          visible={dossierVisible}
          onClose={() => setDossierVisible(false)}
          onDownloadDossier={handleDownloadDossier}
          variant="codec"
        />
      )}

      {/* Codec Header */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 md:gap-12 pt-4 pb-2 px-8 sm:px-16 md:px-24">
        <PortraitFrame image={colonelImg} name="Colonel" isSpeaking={colonelSpeaking} />
        <FrequencyDisplay tokenCount={tokenCount} memoryUsage={memoryUsage} isThinking={isThinking} />
        <PortraitFrame image={snakeImg} name="Snake" />
      </div>

      {/* Divider (only when no tab bar) */}
      {!showTabBar && (
        <div
          className="mx-8 sm:mx-16 md:mx-24 h-px bg-border"
          style={{ boxShadow: "0 0 6px hsl(153 90% 61% / 0.3)" }}
        />
      )}

      {/* Competitor Tabs */}
      {showTabBar && (
        <DossierTabs
          activeTab={activeTab}
          tabs={competitorTabs.map((t) => ({
            id: t.id,
            name: t.name,
            threatLevel: t.threatLevel,
            loaded: !!t.drilldown,
            targetCompany: t.targetCompany,
          }))}
          onTabChange={handleTabChange}
          onDownloadSummary={handleDownloadSummary}
          onDownloadDossier={handleDownloadDossier}
          hasDossier={!!dossierData}
          variant="codec"
        />
      )}

      {/* Chat Area */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto py-6"
        style={{ scrollBehavior: "smooth" }}
      >
        <div className="max-w-3xl mx-auto px-6 sm:px-8 space-y-4">
          <AnimatePresence>
            {currentMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ChatMessage
                  sender={msg.sender}
                  text={msg.text}
                  isNew={msg.id === activeNewId}
                  isReasoning={msg.isReasoning}
                  reasoningStatus={msg.reasoningStatus}
                  reasoningSummary={msg.reasoningSummary}
                  onComplete={() => {
                    if (msg.id === activeNewId) setActiveNewId(null);
                  }}
                  onTick={scrollToBottom}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {pendingConfirmation && (
            <CompanyConfirmation
              resolvedName={pendingConfirmation.response?.dossier?.targetCompany}
              userInput={pendingConfirmation.userInput}
              onConfirm={handleConfirmCompany}
              onAbort={handleAbortCompany}
            />
          )}

          {activeTab === "main" && unexploredCompetitors && unexploredCompetitors.length > 0 && !isProcessing && (
            <CompetitorPicker
              competitors={unexploredCompetitors}
              onSelect={handleCompetitorSelect}
              disabled={isProcessing}
              headingText="▶ SELECT TARGET FOR DEEP RECON"
              borderClassName="codec-border"
              strongBorderClassName="codec-border-strong"
            />
          )}

          {activeTab === "main" && dossierData && !isProcessing && currentSession && currentSession.title !== "New operation" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="my-3"
            >
              <button
                onClick={() => setDossierVisible(true)}
                className="w-full py-3 text-xs font-bold text-foreground text-glow-strong tracking-[0.3em] uppercase mgs-border-strong bg-accent/20 hover:bg-accent/40 transition-all"
              >
                ◈ OPEN INTEL DOSSIER — {dossierData.operationName}
              </button>
            </motion.div>
          )}

          {isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 py-2"
            >
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 animate-pulse" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 animate-pulse" style={{ animationDelay: "300ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 animate-pulse" style={{ animationDelay: "600ms" }} />
              </span>
              <span className="text-xs text-muted-foreground tracking-wider">
                PROCESSING TRANSMISSION
              </span>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="px-4 sm:px-6 pb-5 pt-2">
        <div className="max-w-3xl mx-auto">
          <div
            className="flex items-center gap-3 rounded-2xl border border-foreground/40 bg-muted px-4 py-3 focus-within:border-foreground/70 transition-colors"
            style={{ boxShadow: "0 0 14px hsl(153 90% 61% / 0.25)" }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeTab === "main"
                  ? "Send a message..."
                  : `Ask a follow-up about ${competitorTabs.find((t) => t.id === activeTab)?.name ?? "this target"}...`
              }
              disabled={isProcessing || isConfirming || pendingConfirmation !== null}
              className="flex-1 bg-transparent border-none outline-none text-foreground text-base placeholder:text-foreground/50 font-mono disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isProcessing || isConfirming || !input.trim() || pendingConfirmation !== null}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-foreground/20 text-foreground hover:bg-foreground/35 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodecScreen;
