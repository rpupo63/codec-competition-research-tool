import { motion } from "framer-motion";
import { useMemo } from "react";

interface FrequencyDisplayProps {
  tokenCount: number;    // cumulative tokens used — displayed as the "frequency" number
  memoryUsage: number;   // 0-100, from API intelLevel
  isThinking: boolean;   // bars only animate when AI is processing
}

const BAR_COUNT = 32;

const FrequencyDisplay = ({ tokenCount, memoryUsage, isThinking }: FrequencyDisplayProps) => {
  // Format token count as a codec-style frequency (e.g., 1,247 → "124.70")
  const formattedTokens = useMemo(() => {
    const padded = String(tokenCount).padStart(5, "0");
    const whole = padded.slice(0, -2) || "0";
    const decimal = padded.slice(-2);
    return `${whole}.${decimal}`;
  }, [tokenCount]);

  // Static bar heights when idle
  const idleBars = useMemo(
    () => Array.from({ length: BAR_COUNT }, (_, i) => 4 + Math.sin(i * 0.5) * 3),
    []
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Token count displayed as "frequency" */}
      <div className="flex flex-col items-center">
        <div className="text-[10px] text-muted-foreground tracking-[0.3em] uppercase mb-1">
          TOKENS
        </div>
        <motion.div
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground text-glow-strong tracking-wider tabular-nums"
          key={tokenCount}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {formattedTokens}
        </motion.div>
      </div>

      {/* Thinking activity bars — only animate when isThinking */}
      <div className="flex items-end gap-[2px] h-8">
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <motion.div
            key={i}
            className="w-[3px] bg-foreground rounded-sm"
            animate={
              isThinking
                ? {
                    height: [
                      `${20 + Math.random() * 80}%`,
                      `${10 + Math.random() * 90}%`,
                      `${20 + Math.random() * 80}%`,
                    ],
                    opacity: [0.4, 0.9, 0.5],
                  }
                : {
                    height: `${idleBars[i]}%`,
                    opacity: 0.2,
                  }
            }
            transition={
              isThinking
                ? {
                    duration: 0.25 + Math.random() * 0.35,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                  }
                : { duration: 0.6, ease: "easeOut" }
            }
          />
        ))}
      </div>

      {/* Label */}
      <div className="text-xs text-muted-foreground tracking-[0.3em] uppercase">
        {isThinking ? "THINKING" : "STANDBY"}
      </div>

      {/* Memory bar — linked to backend intelLevel */}
      <div className="w-full max-w-[200px]">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1 tracking-wider">
          {/* TODO: Replace with actual backend context window / memory metric */}
          <span>MEMORY</span>
          <span>{memoryUsage}%</span>
        </div>
        <div className="h-2 bg-muted rounded-sm overflow-hidden codec-border">
          <motion.div
            className="h-full bg-foreground"
            animate={{ width: `${memoryUsage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              boxShadow: "0 0 8px hsl(153 90% 61% / 0.6)",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default FrequencyDisplay;
