import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PortraitFrame from "./PortraitFrame";
import FrequencyDisplay from "./FrequencyDisplay";
import ChatMessage from "./ChatMessage";
import ScanlineOverlay from "./ScanlineOverlay";
import SignalLostOverlay from "./SignalLostOverlay";
import CompetitorPicker from "./CompetitorPicker";
import { sendMessage, fetchCompetitorDrilldown } from "@/services/MockApiService";
import type { CompetitorData } from "@/types/codec";
import colonelImg from "@/assets/colonel.png";
import snakeImg from "@/assets/snake.png";

interface Message {
  id: number;
  sender: string;
  text: string;
  isReasoning?: boolean;
  reasoningStatus?: 'pending' | 'complete';
}

const CodecScreen = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      sender: "COLONEL",
      text: "Snake, do you read me? This is a secure channel. I'll be your support for this operation. If you need intel on competitors, just ask. Stay sharp out there.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [colonelSpeaking, setColonelSpeaking] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [activeNewId, setActiveNewId] = useState<number | null>(null);
  const [signalLost, setSignalLost] = useState(false);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  // Competitor selection state
  const [selectableCompetitors, setSelectableCompetitors] = useState<CompetitorData[] | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const scrollToBottom = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectableCompetitors, scrollToBottom]);

  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { ...msg, id }]);
    setActiveNewId(id);
    return id;
  }, []);

  const updateReasoningStatus = useCallback((msgId: number, status: 'pending' | 'complete') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, reasoningStatus: status } : m))
    );
  }, []);

  const showReasoningSteps = async (reasoning: { step: string; status: string }[]) => {
    for (const step of reasoning) {
      const id = nextId.current++;
      setColonelSpeaking(true);
      setMessages((prev) => [
        ...prev,
        { id, sender: "SYSTEM", text: step.step, isReasoning: true, reasoningStatus: "pending" },
      ]);
      setActiveNewId(id);
      const stepTokens = Math.ceil(step.step.length / 4);
      setTokenCount((prev) => prev + stepTokens);
      await new Promise<void>((resolve) => setTimeout(resolve, 600 + step.step.length * 18));
      updateReasoningStatus(id, "complete");
    }
  };

  const processMessage = async (userMessage: string) => {
    setIsProcessing(true);
    setIsThinking(true);
    setSelectableCompetitors(null);

    try {
      const response = await sendMessage(userMessage);

      await showReasoningSteps(response.reasoning);
      setIsThinking(false);

      setTokenCount((prev) => prev + response.tokensUsed);
      setMemoryUsage(response.intelLevel);

      setColonelSpeaking(true);
      addMessage({ sender: "COLONEL", text: response.finalAnalysis });

      // If competitors returned, show the picker instead of just listing them
      if (response.competitors && response.competitors.length > 0) {
        // Show brief intel cards
        for (const comp of response.competitors) {
          await new Promise<void>((resolve) => setTimeout(resolve, 300));
          addMessage({
            sender: "INTEL",
            text: `[${comp.threat_level}] ${comp.name} — ${comp.intel}`,
          });
        }
        // Enable the picker
        setSelectableCompetitors(response.competitors);
      }

      setLastFailedMessage(null);
    } catch {
      setIsThinking(false);
      setSignalLost(true);
      setLastFailedMessage(userMessage);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setColonelSpeaking(false), 2000);
    }
  };

  const handleCompetitorSelect = async (competitor: CompetitorData) => {
    setSelectableCompetitors(null);
    addMessage({ sender: "SNAKE", text: `Colonel, give me everything on ${competitor.name}.` });
    setIsProcessing(true);
    setIsThinking(true);

    try {
      const drilldown = await fetchCompetitorDrilldown(competitor.id);

      await showReasoningSteps(drilldown.reasoning);
      setIsThinking(false);

      setTokenCount((prev) => prev + drilldown.tokensUsed);
      setMemoryUsage(drilldown.intelLevel);

      setColonelSpeaking(true);
      addMessage({ sender: "COLONEL", text: drilldown.finalAnalysis });

      // Show detailed intel
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      addMessage({
        sender: "INTEL",
        text: `MARKET SHARE: ${drilldown.details.marketShare}`,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      addMessage({
        sender: "INTEL",
        text: `KEY PRODUCTS: ${drilldown.details.keyProducts.join(" | ")}`,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      addMessage({
        sender: "INTEL",
        text: `WEAKNESSES: ${drilldown.details.weaknesses.join(" | ")}`,
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      addMessage({
        sender: "COLONEL",
        text: `RECOMMENDATION: ${drilldown.details.recommendation}`,
      });
    } catch {
      setIsThinking(false);
      setSignalLost(true);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setColonelSpeaking(false), 2000);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const userMessage = input.trim();
    setInput("");
    setSelectableCompetitors(null);
    addMessage({ sender: "SNAKE", text: userMessage });
    await processMessage(userMessage);
  };

  const handleRetry = async () => {
    setSignalLost(false);
    if (lastFailedMessage) {
      await processMessage(lastFailedMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden relative">
      <ScanlineOverlay />
      <SignalLostOverlay visible={signalLost} onDismiss={handleRetry} />

      {/* Codec Header */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 md:gap-12 pt-4 pb-2 px-4">
        <PortraitFrame image={colonelImg} name="Colonel" isSpeaking={colonelSpeaking} />
        <FrequencyDisplay tokenCount={tokenCount} memoryUsage={memoryUsage} isThinking={isThinking} />
        <PortraitFrame image={snakeImg} name="Snake" />
      </div>

      {/* Divider */}
      <div className="mx-4 sm:mx-8 h-px bg-border" style={{ boxShadow: "0 0 6px hsl(153 90% 61% / 0.3)" }} />

      {/* Chat Area */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 space-y-1"
        style={{ scrollBehavior: "smooth" }}
      >
        <AnimatePresence>
          {messages.map((msg) => (
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
                onComplete={() => {
                  if (msg.id === activeNewId) setActiveNewId(null);
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Competitor Picker */}
        {selectableCompetitors && !isProcessing && (
          <CompetitorPicker
            competitors={selectableCompetitors}
            onSelect={handleCompetitorSelect}
            disabled={isProcessing}
          />
        )}

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground animate-pulse-glow tracking-wider"
          >
            ▶ PROCESSING TRANSMISSION...
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border px-4 sm:px-8 py-3" style={{ boxShadow: "0 -2px 12px hsl(153 90% 61% / 0.1)" }}>
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <span className="text-xs text-muted-foreground tracking-widest hidden sm:inline">▶</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="COMM..."
            disabled={isProcessing}
            className="flex-1 bg-transparent border-none outline-none text-foreground text-sm placeholder:text-muted-foreground tracking-wider font-mono disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isProcessing || !input.trim()}
            className="text-xs text-foreground text-glow tracking-widest uppercase hover:text-glow-strong transition-all disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1 codec-border hover:codec-border-strong"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodecScreen;
