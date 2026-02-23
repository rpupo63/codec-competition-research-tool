import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import PortraitFrame from "@/components/shared/PortraitFrame";
import FrequencyDisplay from "@/components/shared/FrequencyDisplay";
import ChatMessage from "@/components/shared/ChatMessage";
import ErrorDialog from "@/components/shared/ErrorDialog";
import type { ErrorType } from "@/types/common";

import DossierPanel from "@/components/shared/DossierPanel";
import DossierTabs from "@/components/shared/DossierTabs";
import {
  sendMessageStream,
  fetchCompetitorDrilldown,
  CompanyNotFoundError,
  NoCompetitorsError,
  SystemFailureError,
  type ConversationTurn,
  getSession,
  getSessionCompetitors,
  type ApiMessage,
  type CompetitorItem, // Import CompetitorItem
} from "@/services/ApiService";
import type { CompetitorDrilldown, CompetitorAnalysisReport, ChallengeEntry, StrategicRecommendationEntry } from "@/types/report";
import {
  downloadTextFile,
  generateConversationSummary,
  generateDossierReport,
} from "@/lib/download";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import colonelImg from "@/assets/colonel.png";
import snakeImg from "@/assets/snake.png";
import { useChatSession } from "@/contexts/ChatSessionContext"; // Import useChatSession
import type { IntelDossier, VulnerabilityEntry, StrikePlanEntry as IntelStrikePlanEntry } from "@/types/codec";

interface Message {
  id: number;
  sender: string;
  text: string;
  isReasoning?: boolean;
  reasoningStatus?: "pending" | "complete";
  reasoningSummary?: string;
}

interface CompetitorTabInfo {
  id: string;
  name: string;
  threatLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  competitor: CompetitorItem; // Use CompetitorItem here
  drilldown?: CompetitorDrilldown;
  targetCompany: string;
}



interface ReportScreenProps {
  onTitleReady?: (title: string) => void;
}

// Sanitize step text to hide internal service names and use user-friendly language
const STEP_REPLACEMENTS: [RegExp, string][] = [
  [/\bserp\b/gi, "web research"],
  [/\benrichlayer\b/gi, "data enrichment"],
  [/\benrich\s?layer\b/gi, "data enrichment"],
  [/\bcalling\s+(the\s+)?(serp|enrichlayer|enrich\s?layer)\s*(api|service|endpoint)?\b/gi, "gathering data"],
  [/\b(serp|google)\s*(search|query|api)\b/gi, "web research"],
  [/\bapi\s+(call|request)\b/gi, "data lookup"],
];

function sanitizeStepText(text: string): string {
  let result = text;
  for (const [pattern, replacement] of STEP_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// Helper function to transform CompetitorAnalysisReport to IntelDossier
const transformCompetitorAnalysisReportToIntelDossier = (report: CompetitorAnalysisReport): IntelDossier => {
  return {
    classification: report.classification,
    targetCompany: report.targetCompany,
    operationName: report.operationName,
    dateCompiled: report.dateCompiled,
    matrix: report.matrix,
    vulnerabilities: report.challenges.map(c => ({
      competitor: c.competitor,
      gaps: c.gaps
    })) as VulnerabilityEntry[], // Map challenges to vulnerabilities
    strikePlan: report.strikePlan.map(s => ({
      codename: s.codename,
      objective: s.objective,
      target: s.target,
      approach: s.approach,
      timeline: s.timeline,
      priority: s.priority
    })) as IntelStrikePlanEntry[], // Map strikePlan entries
  };
};

const ReportScreen = ({ onTitleReady }: ReportScreenProps) => {
  const hasFiredFirstMessage = useRef(false);
  const { activeSessionId, isLoading: isSessionLoading } = useChatSession(); // Get activeSessionId from context
  const [activeTab, setActiveTab] = useState("main");
  const [competitorTabs, setReportTabs] = useState<CompetitorTabInfo[]>([]);

  const activeTabInfo = competitorTabs.find((t) => t.id === activeTab);
  const isCurrentTabLoaded = !!activeTabInfo?.drilldown;
  const [messagesByTab, setMessagesByTab] = useState<Record<string, Message[]>>({
    main: [],
  });

  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [colonelSpeaking, setColonelSpeaking] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [activeNewId, setActiveNewId] = useState<number | null>(null);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [errorCompanyName, setErrorCompanyName] = useState<string | undefined>(undefined);

  const [dossierData, setDossierData] = useState<CompetitorAnalysisReport | null>(null);
  const [dossierVisible, setDossierVisible] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isAiActive = isProcessing || isThinking || colonelSpeaking || activeNewId !== null;
  //const { play, stop } = useAudioPlayback("/mother.wav");

  const currentMessages = useMemo(() => messagesByTab[activeTab] || [], [messagesByTab, activeTab]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, scrollToBottom, activeTab]);

  // Reset all session-specific state when the active session changes
  useEffect(() => {
    if (!activeSessionId) return;
    setMessagesByTab({ main: [] });
    setReportTabs([]);
    setDossierData(null);
    setDossierVisible(false);
    setActiveTab("main");
    hasFiredFirstMessage.current = false;
  }, [activeSessionId]);

  // Hydrate messages and competitor tabs from backend when activeSessionId changes
  useEffect(() => {
    if (isSessionLoading || !activeSessionId || activeSessionId.startsWith("session-")) return;

    const currentMainMessages = messagesByTab["main"];
    // Only load if the main tab is currently empty
    if (currentMainMessages.length === 0) {
      const fetchSessionData = async () => {
        try {
          const [sessionData, competitorData] = await Promise.all([
            getSession(activeSessionId),
            getSessionCompetitors(activeSessionId),
          ]);

          // Split all messages by tab_id
          const byTab: Record<string, Message[]> = { main: [] };
          for (const msg of sessionData.messages) {
            const tabId = msg.tab_id || "main";
            if (!byTab[tabId]) byTab[tabId] = [];
            byTab[tabId].push({
              id: nextId.current++,
              sender: msg.sender,
              text: msg.text,
              isReasoning: msg.is_reasoning,
              reasoningStatus: msg.reasoning_status as "pending" | "complete",
              reasoningSummary: msg.reasoning_summary,
            });
          }
          setMessagesByTab(byTab);

          // Reconstruct competitor tabs
          if (competitorData.competitors.length > 0) {
            setReportTabs(
              competitorData.competitors.map((c) => ({
                id: c.id,
                name: c.name,
                threatLevel: c.threat_level as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
                competitor: {
                  ...c,
                  threat_level: c.threat_level as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
                },
                targetCompany: competitorData.dossier?.targetCompany ?? "",
              }))
            );
          }

          // Restore dossier
          if (competitorData.dossier) {
            const transformedDossier: CompetitorAnalysisReport = {
              classification: competitorData.dossier.classification,
              targetCompany: competitorData.dossier.targetCompany,
              operationName: competitorData.dossier.operationName,
              dateCompiled: competitorData.dossier.dateCompiled,
              matrix: competitorData.dossier.matrix.map(item => ({
                ...item,
                aiCapability: item.aiCapability as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
              })),
              challenges: competitorData.dossier.vulnerabilities.map(v => ({
                competitor: v.competitor,
                gaps: v.gaps,
              })),
              strikePlan: competitorData.dossier.strikePlan.map(item => ({
                ...item,
                priority: item.priority as "ALPHA" | "BRAVO" | "CHARLIE",
              })),
            };
            setDossierData(transformedDossier);
          }

          // Prevent onTitleReady from firing again in a restored session
          if (sessionData.messages.length > 0) {
            hasFiredFirstMessage.current = true;
          }
        } catch (error) {
          console.error("Failed to load session data:", error);
        }
      };
      fetchSessionData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, isSessionLoading]);

  const addMessage = useCallback((tabId: string, msg: Omit<Message, "id">) => {
    const id = nextId.current++;
    setMessagesByTab((prev) => ({
      ...prev,
      [tabId]: [...(prev[tabId] || []), { ...msg, id }],
    }));
    setActiveNewId(id);
    return id;
  }, []);

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

  const showReasoningSteps = async (
    tabId: string,
    reasoning: { step: string; summary: string; status: string }[],
  ) => {
    for (const step of reasoning) {
      const id = nextId.current++;
      setColonelSpeaking(true);
      const displayText = sanitizeStepText(step.step);
      setMessagesByTab((prev) => ({
        ...prev,
        [tabId]: [
          ...(prev[tabId] || []),
          {
            id,
            sender: "SYSTEM",
            text: displayText,
            isReasoning: true,
            reasoningStatus: "pending",
            reasoningSummary: step.summary,
          },
        ],
      }));
      setActiveNewId(id);
      const stepTokens = Math.ceil(displayText.length / 4);
      setTokenCount((prev) => prev + stepTokens);
      await new Promise<void>((resolve) => setTimeout(resolve, 600 + displayText.length * 18));
      updateReasoningStatus(tabId, id, "complete");
    }
  };

  const handleError = (error: unknown, tabId: string = "main") => {
    setIsThinking(false);

    if (error instanceof CompanyNotFoundError) {
      setErrorType("company_not_found");
      setErrorCompanyName(error.companyName);
      setErrorDialogVisible(true);
      addMessage(tabId, {
        sender: "SYSTEM",
        text: `⊘ No data found for "${error.companyName}".`,
        isReasoning: true,
        reasoningStatus: "complete",
      });
    } else if (error instanceof NoCompetitorsError) {
      setErrorType("no_competitors");
      setErrorCompanyName(error.companyName);
      setErrorDialogVisible(true);
      addMessage(tabId, {
        sender: "SYSTEM",
        text: `◇ "${error.companyName}" found, but no direct competitors identified.`,
        isReasoning: true,
        reasoningStatus: "complete",
      });
    } else if (error instanceof SystemFailureError) {
      setErrorType("system_failure");
      setErrorCompanyName(undefined);
      setErrorDialogVisible(true);
      addMessage(tabId, {
        sender: "SYSTEM",
        text: "⚠ Analysis temporarily unavailable. Please try again.",
        isReasoning: true,
        reasoningStatus: "complete",
      });
    } else {
      setErrorType("system_failure");
      setErrorDialogVisible(true);
    }
  };

  const pendingStepMessageIds = useRef<Map<string, number>>(new Map());

  const updateMessageContent = useCallback(
    (tabId: string, messageId: number, newText: string, newReasoningStatus: "pending" | "complete", newReasoningSummary: string) => {
      setMessagesByTab((prev) => ({
        ...prev,
        [tabId]: (prev[tabId] || []).map((m) =>
          m.id === messageId ? { ...m, text: newText, reasoningStatus: newReasoningStatus, reasoningSummary: newReasoningSummary } : m,
        ),
      }));
    },
    [],
  );

  const processMessage = async (userMessage: string, competitorId: string | undefined) => {
    if (!activeSessionId) {
      console.error("No active session ID available to process message.");
      return;
    }

    setIsProcessing(true);
    setIsThinking(true);

    // Collect conversation history from the active tab before sending
    const tabId = competitorId || "main";
    const history: ConversationTurn[] = (messagesByTab[tabId] || [])
      .filter((m) => m.sender === "SNAKE" || m.sender === "COLONEL")
      .map((m) => ({
        role: m.sender === "SNAKE" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));

    await sendMessageStream(
      userMessage,
      // onStep: called for each pipeline stage (pending then complete)
      (step, summary, status) => {
        const displayText = sanitizeStepText(step);
        if (status === "pending") {
          let messageId = pendingStepMessageIds.current.get(step);
          if (messageId) {
            // Update existing pending message
            updateMessageContent(tabId, messageId, displayText, "pending", summary);
          } else {
            // Add new pending message
            messageId = addMessage(tabId, {
              sender: "SYSTEM",
              text: displayText,
              isReasoning: true,
              reasoningStatus: "pending",
              reasoningSummary: summary,
            });
            pendingStepMessageIds.current.set(step, messageId);
          }
          setTokenCount((prev) => prev + Math.ceil(displayText.length / 4));
        } else { // status === "complete"
          const messageId = pendingStepMessageIds.current.get(step);
          if (messageId !== undefined) {
            updateReasoningStatus(tabId, messageId, "complete");
            pendingStepMessageIds.current.delete(step);
          }
        }
      },
      // onDone: full response received
      async (response) => {
        // Clear any remaining pending steps from the map
        pendingStepMessageIds.current.clear();
        setIsThinking(false);
        setTokenCount((prev) => prev + response.tokensUsed);
        setMemoryUsage(response.intelLevel);

        setColonelSpeaking(true);
        addMessage(tabId, { sender: "COLONEL", text: response.finalAnalysis });

        // Follow-up / conversational response: Competitors were found.
        if (response.competitors && response.competitors.length > 0) {
          const targetCompany = response.dossier?.targetCompany || "UNKNOWN";

          for (const comp of response.competitors) {
            await new Promise<void>((resolve) => setTimeout(resolve, 300));
            addMessage(tabId, {
              sender: "INTEL",
              text: `${comp.name} — ${comp.intel} [risk: ${comp.threat_level}]`,
            });
          }

          // Only add new competitor tabs if we are on the main tab
          if (!competitorId) {
            setReportTabs((prev) => {
              const existingIds = new Set(prev.map((t) => t.id));
              const newTabs = response.competitors
                .filter((comp) => !existingIds.has(comp.id))
                .map((comp) => ({
                  id: comp.id,
                  name: comp.name,
                  threatLevel: comp.threat_level as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
                  competitor: {
                    ...comp,
                    threat_level: comp.threat_level as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
                  },
                  targetCompany,
                }));
              return newTabs.length > 0 ? [...prev, ...newTabs] : prev;
            });

            // Check if there are truly new competitors to avoid redundant messages
            const existingCompetitorIds = new Set(competitorTabs.map((t) => t.id));
            const newlyAddedCompetitors = response.competitors.filter(
              (comp) => !existingCompetitorIds.has(comp.id),
            );

            if (newlyAddedCompetitors.length > 0) {
              addMessage("main", {
                sender: "SYSTEM",
                text: "✔ Competitors identified. Select a tab above for detailed analysis.",
              });
            }
          }

          setMessagesByTab((prev) => {
            const updated = { ...prev };
            let changed = false;
            for (const comp of response.competitors) {
              // Only create new message arrays for competitors if on the main tab
              if (!competitorId && !updated[comp.id]) {
                updated[comp.id] = [];
                changed = true;
              }
            }
            return changed ? updated : prev;
          });
        } else {
          // If we are in a competitor tab and there are no new competitors, do not add the system message
          if (competitorId) return;
        }



        if (response.dossier) {
          const transformedDossier: CompetitorAnalysisReport = {
            classification: response.dossier.classification,
            targetCompany: response.dossier.targetCompany,
            operationName: response.dossier.operationName,
            dateCompiled: response.dossier.dateCompiled,
            matrix: response.dossier.matrix.map(item => ({
              ...item,
              aiCapability: item.aiCapability as "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
            })),
            challenges: response.dossier.vulnerabilities.map(v => ({
              competitor: v.competitor,
              gaps: v.gaps,
            })),
            strikePlan: response.dossier.strikePlan.map(item => ({
              ...item,
              priority: item.priority as "ALPHA" | "BRAVO" | "CHARLIE",
            })),
          };
            setDossierData(transformedDossier);
          }

        if (!hasFiredFirstMessage.current && onTitleReady) {
          hasFiredFirstMessage.current = true;
          onTitleReady(response.dossier?.targetCompany ?? userMessage.slice(0, 40));
        }
      },
      // onError
      (error) => {
        handleError(error, tabId);
      },
      undefined,
      history,
      activeSessionId,
      competitorId, // Pass competitorId here
    ).catch((err) => handleError(err, tabId))
      .finally(() => {
        setIsProcessing(false);
        setTimeout(() => setColonelSpeaking(false), 2000);
      });
  };

  const loadCompetitorDrilldown = async (tabId: string) => {
    const tab = competitorTabs.find((t) => t.id === tabId);
    if (!tab || tab.drilldown) return;

    addMessage(tabId, {
      sender: "SNAKE",
      text: `Walk me through ${tab.name}.`,
    });
    setIsProcessing(true);
    setIsThinking(true);

    try {
      const drilldown = await fetchCompetitorDrilldown(tab.id);

      await showReasoningSteps(tabId, drilldown.reasoning);
      setIsThinking(false);

      setTokenCount((prev) => prev + drilldown.tokensUsed);
      setMemoryUsage(drilldown.intelLevel);

      setColonelSpeaking(true);
      addMessage(tabId, { sender: "COLONEL", text: drilldown.finalAnalysis });

      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      addMessage(tabId, {
        sender: "INTEL",
        text: `MARKET SHARE: ${drilldown.details.marketShare}`,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      addMessage(tabId, {
        sender: "INTEL",
        text: `KEY PRODUCTS: ${drilldown.details.keyProducts.join(" | ")}`,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      addMessage(tabId, {
        sender: "INTEL",
        text: `CHALLENGES: ${drilldown.details.challenges.join(" | ")}`,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      addMessage(tabId, {
        sender: "COLONEL",
        text: `RECOMMENDATION: ${drilldown.details.recommendation}`,
      });

      setReportTabs((prev) =>
        prev.map((t) => (t.id === tabId ? {
          ...t,
          drilldown: {
            ...drilldown,
            reasoning: drilldown.reasoning.map(step => ({
              ...step,
              status: step.status as "pending" | "complete"
            }))
          }
        } : t)),
      );
    } catch (error) {
      handleError(error, tabId);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setColonelSpeaking(false), 2000);
    }
  };

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



  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    //play();
    const userMessage = input.trim();
    setInput("");

    // The message should be added to the current active tab
    addMessage(activeTab, { sender: "SNAKE", text: userMessage });

    // If activeTab is not "main", it's a competitor ID
    const competitorId = activeTab !== "main" ? activeTab : undefined;
    await processMessage(userMessage, competitorId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDownloadSummary = () => {
    const tab = competitorTabs.find((t) => t.id === activeTab);
    if (!tab) return;
    const msgs = messagesByTab[activeTab] || [];

    // Transform drilldown from the 'report' type to the 'codec' type for the summary function
    const drilldownForSummary = tab.drilldown
      ? {
          ...tab.drilldown,
          details: {
            ...tab.drilldown.details,
            weaknesses: tab.drilldown.details.challenges, // Map challenges to weaknesses
          },
        }
      : undefined;

    const content = generateConversationSummary(
      tab.competitor,
      msgs,
      drilldownForSummary,
    );
    const safeName = tab.name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    downloadTextFile(content, `analysis-${safeName}.txt`);
  };

  const handleDownloadDossier = () => {
    if (!dossierData) return;
    const dossierForReport = transformCompetitorAnalysisReportToIntelDossier(dossierData);
    const content = generateDossierReport(dossierForReport);
    const safeName = dossierData.operationName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    downloadTextFile(content, `report-${safeName}.txt`);
  };

  const showTabBar = competitorTabs.length > 0;

  // suppress unused warning — isCurrentTabLoaded may be used by future UI
  void isCurrentTabLoaded;

  return (
    <div className="flex flex-col h-svh bg-background overflow-hidden relative">
      <ErrorDialog
        visible={errorDialogVisible}
        errorType={errorType}
        companyName={errorCompanyName}
        onDismiss={() => setErrorDialogVisible(false)}
        variant="report"
      />
      {dossierData && (
        <DossierPanel
          dossier={dossierData}
          visible={dossierVisible}
          onClose={() => setDossierVisible(false)}
          onDownloadDossier={handleDownloadDossier}
          variant="report"
        />
      )}

      {/* Report Header */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 md:gap-12 pt-4 pb-2 px-8 sm:px-16 md:px-24">
        <PortraitFrame image={colonelImg} name="Analyst" isSpeaking={colonelSpeaking} />
        <FrequencyDisplay tokenCount={tokenCount} memoryUsage={memoryUsage} isThinking={isThinking} borderClassName="report-border" />
        <PortraitFrame image={snakeImg} name="You" />
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
          dossierData={dossierData}
          setDossierVisible={setDossierVisible}
          variant="report"
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
                  userLabel="You"
                  analystLabel="Analyst"
                />
              </motion.div>
            ))}
          </AnimatePresence>




          {activeTab === "main" && dossierData && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="my-3"
            >
              <button
                onClick={() => setDossierVisible(true)}
                className="w-full py-3 text-xs font-bold text-foreground text-glow-strong tracking-[0.3em] uppercase report-border-strong bg-accent/20 hover:bg-accent/40 transition-all"
              >
                ◈ VIEW INTELLIGENCE REPORT — {dossierData.operationName}
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
                ANALYZING...
              </span>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Chat Input */}
      <div className="px-6 sm:px-8 pb-4 pt-2 border-t border-border/40">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            disabled={isProcessing}
            rows={2}
            className="flex-1 resize-none bg-transparent border-border/50 focus-visible:ring-1 focus-visible:ring-foreground/30 text-sm font-mono placeholder:text-muted-foreground/40 tracking-wider"
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim()}
            className="px-4 py-2 text-xs font-bold tracking-[0.2em] uppercase border border-foreground/30 hover:border-foreground/60 hover:bg-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all self-end mb-0.5"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReportScreen;