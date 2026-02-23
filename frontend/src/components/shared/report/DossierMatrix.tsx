import type { DossierMatrixEntry } from "@/types/report";

interface DossierMatrixProps {
  entries: DossierMatrixEntry[];
  target: string;
}

const threatColor: Record<string, string> = {
  LOW: "text-muted-foreground",
  MODERATE: "text-foreground",
  HIGH: "text-foreground text-glow",
  CRITICAL: "text-destructive",
};

const aiColor: Record<string, string> = {
  LOW: "text-muted-foreground",
  MODERATE: "text-foreground",
  HIGH: "text-foreground text-glow",
  CRITICAL: "text-destructive",
};

const DossierMatrix = ({ entries, target }: DossierMatrixProps) => {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground tracking-[0.3em] mb-3">
        COMPETITIVE MATRIX — VS. {target}
      </div>

      <div className="space-y-3">
        {entries.map((entry, i) => (
          <div key={i} className="mgs-border bg-muted/30 p-4">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-foreground text-glow tracking-wider">
                {entry.name}
              </div>
              <div className={`text-[10px] tracking-widest font-bold ${threatColor[entry.threat_level]}`}>
                RISK: {entry.threat_level}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <div className="text-[9px] text-muted-foreground tracking-widest mb-0.5">MARKET SHARE</div>
                <div className="text-xs text-foreground">{entry.marketShare}</div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground tracking-widest mb-0.5">AI CAPABILITY</div>
                <div className={`text-xs font-bold ${aiColor[entry.aiCapability]}`}>{entry.aiCapability}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[9px] text-muted-foreground tracking-widest mb-0.5">KEY STRENGTH</div>
                <div className="text-xs text-foreground">{entry.keyStrength}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[9px] text-muted-foreground tracking-widest mb-0.5">PRIMARY PRODUCT</div>
                <div className="text-xs text-foreground">{entry.primaryProduct}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DossierMatrix;
