import type { StrikePlanEntry } from "@/types/codec";

interface DossierStrikePlanProps {
  entries: StrikePlanEntry[];
}

const priorityStyle: Record<string, { color: string; label: string }> = {
  ALPHA: { color: "text-destructive", label: "⬤ PRIORITY ALPHA" },
  BRAVO: { color: "text-foreground text-glow", label: "◉ PRIORITY BRAVO" },
  CHARLIE: { color: "text-muted-foreground", label: "○ PRIORITY CHARLIE" },
};

const DossierStrikePlan = ({ entries }: DossierStrikePlanProps) => {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground tracking-[0.3em] mb-3">
        STRATEGIC STRIKE PLAN — RECOMMENDED OPERATIONS
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
