import type { StrategicRecommendationEntry } from "@/types/report";

interface DossierStrikePlanProps {
  entries: StrategicRecommendationEntry[];
}

const priorityStyle: Record<string, { color: string; label: string }> = {
  ALPHA: { color: "text-destructive", label: "⬤ HIGH PRIORITY" },
  BRAVO: { color: "text-foreground text-glow", label: "◉ MEDIUM PRIORITY" },
  CHARLIE: { color: "text-muted-foreground", label: "○ LOW PRIORITY" },
};

const DossierStrikePlan = ({ entries }: DossierStrikePlanProps) => {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground tracking-[0.3em] mb-3">
        STRATEGIC RECOMMENDATIONS — ACTION PLAN
      </div>

      <div className="space-y-4">
        {entries.map((entry, i) => {
          const prio = priorityStyle[entry.priority] || priorityStyle.CHARLIE;
          return (
            <div key={i} className="mgs-border-strong bg-muted/30 p-4">
              {/* Operation header */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-foreground text-glow-strong tracking-wider">
                  ▶ {entry.codename}
                </div>
                <div className={`text-[10px] tracking-widest font-bold ${prio.color}`}>
                  {prio.label}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2">
                <div>
                  <div className="text-[9px] text-muted-foreground tracking-widest mb-0.5">OBJECTIVE</div>
                  <div className="text-xs text-foreground leading-relaxed">{entry.objective}</div>
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground tracking-widest mb-0.5">TARGET</div>
                  <div className="text-xs text-foreground">{entry.target}</div>
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground tracking-widest mb-0.5">APPROACH</div>
                  <div className="text-xs text-foreground/80 leading-relaxed">{entry.approach}</div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <div>
                    <div className="text-[9px] text-muted-foreground tracking-widest mb-0.5">TIMELINE</div>
                    <div className="text-xs text-foreground">{entry.timeline}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DossierStrikePlan;
