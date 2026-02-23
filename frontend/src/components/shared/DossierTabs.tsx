import { Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TabEntry } from "@/types/common";
import type { CompetitorAnalysisReport } from "@/types/report"; // Only needed for report variant

interface DossierTabsProps {
  activeTab: string;
  tabs: TabEntry[];
  onTabChange: (tabId: string) => void;
  variant: "codec" | "report";
  // Codec specific
  onDownloadSummary?: () => void;
  onDownloadDossier?: () => void;
  hasDossier?: boolean;
  // Report specific
  dossierData?: CompetitorAnalysisReport | null; // Optional for codec variant
  setDossierVisible?: (visible: boolean) => void; // Optional for codec variant
}

const THREAT_DOT_COLOR: Record<string, string> = {
  LOW: "bg-muted-foreground",
  MODERATE: "bg-foreground/60",
  HIGH: "bg-foreground",
  CRITICAL: "bg-destructive",
};

const DossierTabs = ({
  activeTab,
  tabs,
  onTabChange,
  variant,
  onDownloadSummary,
  onDownloadDossier,
  hasDossier,
  dossierData,
  setDossierVisible,
}: DossierTabsProps) => {
  const activeTabInfo = tabs.find((t) => t.id === activeTab);
  const showDownloads = activeTabInfo?.loaded && variant === "codec";

  const groups: [string, TabEntry[]][] = [];
  const seen = new Map<string, TabEntry[]>();
  for (const tab of tabs) {
    const key = tab.targetCompany;
    if (!seen.has(key)) {
      const arr: TabEntry[] = [];
      seen.set(key, arr);
      groups.push([key, arr]);
    }
    seen.get(key)!.push(tab);
  }

  const borderClass = variant === "codec" ? "codec-border" : "report-border";
  const borderStrongClass = variant === "codec" ? "codec-border-strong" : "report-border-strong";
  const mainTabLabel = variant === "codec" ? "◈ COMMS" : "◈ CHAT";

  return (
    <div className="px-4 sm:px-8 pt-2">
      <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => onTabChange("main")}
          className={`shrink-0 px-3 py-1.5 text-[10px] tracking-[0.2em] font-bold transition-all ${
            activeTab === "main"
              ? `${borderStrongClass} text-foreground text-glow-strong`
              : `${borderClass} text-muted-foreground hover:text-foreground`
          }`}
        >
          {mainTabLabel}
        </button>

        {variant === "report" && dossierData && setDossierVisible && (
          <button
            onClick={() => setDossierVisible(true)}
            className={`shrink-0 px-3 py-1.5 text-[10px] tracking-[0.2em] font-bold transition-all ${borderClass} text-muted-foreground hover:text-foreground`}
          >
            ◈ OPEN REPORT
          </button>
        )}

        {groups.map(([company, groupTabs]) => (
          <Fragment key={company}>
            <span className="shrink-0 text-[8px] text-muted-foreground/50 tracking-[0.15em] uppercase self-center px-2 border-l border-border/40 ml-1">
              {company}
            </span>

            <AnimatePresence>
              {groupTabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: "auto" }}
                  transition={{ duration: 0.25 }}
                  onClick={() => onTabChange(tab.id)}
                  className={`shrink-0 px-3 py-1.5 text-[10px] tracking-[0.15em] font-bold transition-all flex items-center gap-2 ${
                    activeTab === tab.id
                      ? `${borderStrongClass} text-foreground text-glow-strong`
                      : tab.loaded
                        ? `${borderClass} text-muted-foreground hover:text-foreground`
                        : `${borderClass} text-muted-foreground/50 hover:text-muted-foreground`
                  }`}
                >
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      tab.loaded
                        ? (THREAT_DOT_COLOR[tab.threatLevel] || "bg-foreground")
                        : "bg-muted-foreground/40 animate-pulse"
                    }`}
                  />
                  {tab.name}
                </motion.button>
              ))}
            </AnimatePresence>
          </Fragment>
        ))}
      </div>

      <AnimatePresence>
        {showDownloads && onDownloadSummary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex gap-2 pb-2 overflow-hidden"
          >
            <button
              onClick={onDownloadSummary}
              className={`text-[9px] tracking-[0.2em] text-muted-foreground hover:text-foreground hover:text-glow px-2 py-1 ${borderClass} transition-all uppercase`}
            >
              ▼ DOWNLOAD SUMMARY
            </button>
            {hasDossier && onDownloadDossier && (
              <button
                onClick={onDownloadDossier}
                className={`text-[9px] tracking-[0.2em] text-muted-foreground hover:text-foreground hover:text-glow px-2 py-1 ${borderClass} transition-all uppercase`}
              >
                ▼ DOWNLOAD DOSSIER
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="h-px bg-border"
        style={{ boxShadow: "0 0 6px hsl(153 90% 61% / 0.2)" }}
      />
    </div>
  );
};

export default DossierTabs;
