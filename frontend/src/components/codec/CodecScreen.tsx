import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PortraitFrame from "./PortraitFrame";
import FrequencyDisplay from "./FrequencyDisplay";
import ChatMessage from "./ChatMessage";
import ScanlineOverlay from "./ScanlineOverlay";
import SignalLostOverlay from "./SignalLostOverlay";
import CodecErrorDialog, { type ErrorType } from "./CodecErrorDialog";
import CompetitorPicker from "./CompetitorPicker";
import IntelDossierPanel from "./IntelDossierPanel";
import CompetitorTabs from "./CompetitorTabs";
import {
  sendMessage,
  fetchCompetitorDrilldown,
  CompanyNotFoundError,
  NoCompetitorsError,
  SystemFailureError,
} from "@/services/MockApiService";
import type { CompetitorData, CompetitorDrilldown, IntelDossier } from "@/types/codec";
import {
  downloadTextFile,
  generateConversationSummary,
  generateDossierReport,
} from "@/lib/download";
import { useCodecAudio } from "@/hooks/use-codec-audio";
import colonelImg from "@/assets/colonel.png";
import snakeImg from "@/assets/snake.png";

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
  threatLevel: string;
  competitor: CompetitorData;
  drilldown?: CompetitorDrilldown;
  targetCompany: string;
}

const INITIAL_MESSAGE: Message = {
  id: 0,
  sender: "COLONEL",
  text: "Snake, do you read me? This is a secure channel. I'll be your support for this operation. If you need intel on competitors, just ask. Stay sharp out there.",
};

interface CodecScreenProps {
  sessionId: string;
  onFirstMessage?: (message: string) => void;
}

const CodecScreen = ({ sessionId, onFirstMessage }: CodecScreenProps) => {
  const hasFiredFirstMessage = useRef(false);
  const [activeTab, setActiveTab] = useState("main");
  const [competitorTabs, setCompetitorTabs] = useState<CompetitorTabInfo[]>([]);
  const [messagesByTab, setMessagesByTab] = useState<Record<string, Message[]>>({
    main: [INITIAL_MESSAGE],
  });

  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [colonelSpeaking, setColonelSpeaking] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [activeNewId, setActiveNewId] = useState<number | null>(null);
  const [signalLost, setSignalLost] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [selectableCompetitors, setSelectableCompetitors] = useState<CompetitorData[] | null>(null);

  const [errorDialogVisible, setErrorDialogVisible] = useState(false);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [errorCompanyName, setErrorCompanyName] = useState<string | undefined>(undefined);

  const [dossierData, setDossierData] = useState<IntelDossier | null>(null);
  const [dossierVisible, setDossierVisible] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isAiActive = isProcessing || isThinking || colonelSpeaking || activeNewId !== null;
  const { play: playCodecAudio, stop: stopCodecAudio } = useCodecAudio("/mother.wav");

  useEffect(() => {
    if (!isAiActive) stopCodecAudio();
  }, [isAiActive, stopCodecAudio]);

  const currentMessages = messagesByTab[activeTab] || [];

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, selectableCompetitors, scrollToBottom, activeTab]);

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
      setMessagesByTab((prev) => ({
        ...prev,
        [tabId]: [
          ...(prev[tabId] || []),
          {
            id,
            sender: "SYSTEM",
            text: step.step,
            isReasoning: true,
            reasoningStatus: "pending",
            reasoningSummary: step.summary,
          },
        ],
      }));
      setActiveNewId(id);
      const stepTokens = Math.ceil(step.step.length / 4);
      setTokenCount((prev) => prev + stepTokens);
      await new Promise<void>((resolve) => setTimeout(resolve, 600 + step.step.length * 18));
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
      setSignalLost(true);
      setLastFailedMessage(null);
    }
  };

  const processMessage = async (userMessage: string) => {
    setIsProcessing(true);
    setIsThinking(true);
    setSelectableCompetitors(null);

    try {
      const response = await sendMessage(userMessage);

      await showReasoningSteps("main", response.reasoning);
      setIsThinking(false);

      setTokenCount((prev) => prev + response.tokensUsed);
      setMemoryUsage(response.intelLevel);

      setColonelSpeaking(true);
      addMessage("main", { sender: "COLONEL", text: response.finalAnalysis });

      if (response.competitors && response.competitors.length > 0) {
        const targetCompany = response.dossier?.targetCompany || "UNKNOWN";

        for (const comp of response.competitors) {
          await new Promise<void>((resolve) => setTimeout(resolve, 300));
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
        setDossierData(response.dossier);
      }

      setLastFailedMessage(null);
    } catch (error) {
      handleError(error);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setColonelSpeaking(false), 2000);
    }
  };

  const loadCompetitorDrilldown = async (tabId: string) => {
    const tab = competitorTabs.find((t) => t.id === tabId);
    if (!tab || tab.drilldown) return;

    addMessage(tabId, {
      sender: "SNAKE",
      text: `Colonel, give me everything on ${tab.name}.`,
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
        text: `WEAKNESSES: ${drilldown.details.weaknesses.join(" | ")}`,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      addMessage(tabId, {
        sender: "COLONEL",
        text: `RECOMMENDATION: ${drilldown.details.recommendation}`,
      });

      setCompetitorTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, drilldown } : t)),
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
        playCodecAudio();
        void loadCompetitorDrilldown(tabId);
      }
    }
  };

  const handleCompetitorSelect = (competitor: CompetitorData) => {
    playCodecAudio();
    handleTabChange(competitor.id);
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    playCodecAudio();
    const userMessage = input.trim();
    setInput("");
    setSelectableCompetitors(null);

    if (activeTab !== "main") {
      setActiveTab("main");
    }

    if (!hasFiredFirstMessage.current && onFirstMessage) {
      hasFiredFirstMessage.current = true;
      onFirstMessage(userMessage);
    }

    addMessage("main", { sender: "SNAKE", text: userMessage });
    await processMessage(userMessage);
  };

  const handleRetry = async () => {
    playCodecAudio();
    setSignalLost(false);
    if (lastFailedMessage) {
      await processMessage(lastFailedMessage);
    }
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
      <ScanlineOverlay />
      <SignalLostOverlay visible={signalLost} onDismiss={handleRetry} />
      <CodecErrorDialog
        visible={errorDialogVisible}
        errorType={errorType}
        companyName={errorCompanyName}
        onDismiss={() => setErrorDialogVisible(false)}
      />
      {dossierData && (
        <IntelDossierPanel
          dossier={dossierData}
          visible={dossierVisible}
          onClose={() => setDossierVisible(false)}
          onDownloadDossier={handleDownloadDossier}
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
        <CompetitorTabs
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

          {activeTab === "main" && unexploredCompetitors && unexploredCompetitors.length > 0 && !isProcessing && (
            <CompetitorPicker
              competitors={unexploredCompetitors}
              onSelect={handleCompetitorSelect}
              disabled={isProcessing}
            />
          )}

          {activeTab === "main" && dossierData && !isProcessing && (
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
            className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3 focus-within:border-foreground/40 transition-colors"
            style={{ boxShadow: "0 0 12px hsl(153 90% 61% / 0.06)" }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={activeTab === "main" ? "Send a message..." : "Switch to COMMS tab to transmit..."}
              disabled={isProcessing}
              className="flex-1 bg-transparent border-none outline-none text-foreground text-base placeholder:text-muted-foreground/60 font-mono disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={isProcessing || !input.trim()}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/20 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
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
