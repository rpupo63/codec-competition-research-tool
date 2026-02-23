import { motion } from "framer-motion";
import type { CompetitorData } from "@/types/common";

interface CompetitorPickerProps {
  competitors: CompetitorData[];
  onSelect: (competitor: CompetitorData) => void;
  disabled?: boolean;
  headingText: string;
  borderClassName: string;
  strongBorderClassName: string;
}

const CompetitorPicker = ({ competitors, onSelect, disabled, headingText, borderClassName, strongBorderClassName }: CompetitorPickerProps) => {
  const threatColor: Record<string, string> = {
    LOW: "text-muted-foreground",
    MODERATE: "text-foreground",
    HIGH: "text-foreground",
    CRITICAL: "text-destructive",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-3"
    >
      <div className="text-[10px] text-muted-foreground tracking-[0.3em] uppercase mb-2">
        {headingText}
      </div>
      <div className="flex flex-col gap-2">
        {competitors.map((comp) => (
          <button
            key={comp.id}
            onClick={() => onSelect(comp)}
            disabled={disabled}
            className={`text-left px-3 py-2 ${borderClassName} bg-muted/50 hover:bg-accent hover:${strongBorderClassName} transition-all disabled:opacity-30 disabled:cursor-not-allowed group`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-foreground text-glow tracking-wider font-bold group-hover:text-glow-strong transition-all">
                  {comp.name}
                </span>
                <div className="text-[10px] text-muted-foreground tracking-wider mt-0.5 truncate">
                  {comp.intel}
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className={`text-[10px] tracking-wider font-bold ${threatColor[comp.threat_level] || "text-foreground"}`}>
                  {comp.threat_level}
                </span>
                <span className="text-[10px] text-muted-foreground tracking-wider">
                  {comp.status}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export default CompetitorPicker;
