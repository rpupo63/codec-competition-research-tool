import { motion } from "framer-motion";

interface FrequencyDisplayProps {
  frequency: string;
  memoryUsage: number; // 0-100
}

const FrequencyDisplay = ({ frequency, memoryUsage }: FrequencyDisplayProps) => {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Frequency number */}
      <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground text-glow-strong tracking-wider">
        {frequency}
      </div>

      {/* Frequency bars */}
      <div className="flex items-end gap-[2px] h-8">
        {Array.from({ length: 32 }).map((_, i) => {
          const height = Math.random() * 100;
          return (
            <motion.div
              key={i}
              className="w-[3px] bg-foreground rounded-sm"
              animate={{ height: [`${height}%`, `${Math.random() * 100}%`, `${Math.random() * 100}%`] }}
              transition={{ duration: 0.5 + Math.random() * 0.5, repeat: Infinity, repeatType: "mirror" }}
              style={{ opacity: 0.5 + Math.random() * 0.5 }}
            />
          );
        })}
      </div>

      {/* CALL label */}
      <div className="text-xs text-muted-foreground tracking-[0.3em] uppercase">
        CALL
      </div>

      {/* Memory bar */}
      <div className="w-full max-w-[200px]">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1 tracking-wider">
          <span>MEMORY</span>
          <span>{memoryUsage}%</span>
        </div>
        <div className="h-2 bg-muted rounded-sm overflow-hidden codec-border">
          <motion.div
            className="h-full bg-foreground"
            initial={{ width: 0 }}
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
