import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PortraitFrame from "./PortraitFrame";
import FrequencyDisplay from "./FrequencyDisplay";
import ChatMessage from "./ChatMessage";
import ScanlineOverlay from "./ScanlineOverlay";
import { sendMessage } from "@/services/MockApiService";
import colonelImg from "@/assets/colonel.png";
import snakeImg from "@/assets/snake.png";

interface Message {
  id: number;
  sender: string;
  text: string;
  isReasoning?: boolean;
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
  const [colonelSpeaking, setColonelSpeaking] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState(23);
  const [activeNewId, setActiveNewId] = useState<number | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const scrollToBottom = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const addMessage = useCallback((msg: Omit<Message, "id">) => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { ...msg, id }]);
    setActiveNewId(id);
    return id;
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage = input.trim();
    setInput("");
    addMessage({ sender: "SNAKE", text: userMessage });
    setIsProcessing(true);
    setMemoryUsage((prev) => Math.min(prev + Math.random() * 15, 98));

    try {
      const response = await sendMessage(userMessage);

      // Show reasoning steps sequentially
      for (const step of response.reasoning_steps) {
        await new Promise<void>((resolve) => {
          setColonelSpeaking(true);
          const id = nextId.current++;
          setMessages((prev) => [...prev, { id, sender: "SYSTEM", text: step, isReasoning: true }]);
          setActiveNewId(id);
          setTimeout(resolve, 800 + step.length * 20);
        });
      }

      // Final response
      setColonelSpeaking(true);
      addMessage({ sender: "COLONEL", text: response.response });

      // Show competitor data if present
      if (response.competitors) {
        for (const comp of response.competitors) {
          await new Promise<void>((resolve) => setTimeout(resolve, 400));
          addMessage({
            sender: "INTEL",
            text: `[${comp.threat_level}] ${comp.name} — Status: ${comp.status}. ${comp.intel}`,
          });
        }
      }

      setMemoryUsage((prev) => Math.min(prev + Math.random() * 10, 98));
    } catch {
      addMessage({ sender: "SYSTEM", text: "ERROR: Transmission interrupted. Retry." });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setColonelSpeaking(false), 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden relative">
      <ScanlineOverlay />

      {/* Codec Header */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 md:gap-12 pt-4 pb-2 px-4">
        <PortraitFrame image={colonelImg} name="Colonel" isSpeaking={colonelSpeaking} />
        <FrequencyDisplay frequency="140.85" memoryUsage={memoryUsage} />
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
                onComplete={() => {
                  if (msg.id === activeNewId) setActiveNewId(null);
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>

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
