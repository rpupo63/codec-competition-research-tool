import type { VulnerabilityEntry } from "@/types/codec";

interface DossierVulnerabilitiesProps {
  entries: VulnerabilityEntry[];
}

const DossierVulnerabilities = ({ entries }: DossierVulnerabilitiesProps) => {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground tracking-[0.3em] mb-3">
        VULNERABILITY MAP — EXPLOITABLE GAPS
      </div>

      <div className="space-y-4">
        {entries.map((entry, i) => (
          <div key={i} className="mgs-border bg-muted/30 p-4">
            <div className="text-sm font-bold text-foreground text-glow tracking-wider mb-3">
              ◆ {entry.competitor}
            </div>

            <div className="space-y-2">
              {entry.gaps.map((gap, j) => (
                <div key={j} className="flex items-start gap-2">
                  <span className="text-foreground text-xs mt-0.5 shrink-0 opacity-50">▸</span>
                  <span className="text-xs text-foreground/80 leading-relaxed">{gap}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DossierVulnerabilities;
