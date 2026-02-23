import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { IntelDossier } from "@/types/codec";
import type { CompetitorAnalysisReport } from "@/types/report";
import DossierMatrixCodec from "@/components/shared/codec/DossierMatrix";
import DossierVulnerabilitiesCodec from "@/components/shared/codec/DossierVulnerabilities";
import DossierStrikePlanCodec from "@/components/shared/codec/DossierStrikePlan";
import DossierMatrixReport from "@/components/shared/report/DossierMatrix";
import DossierVulnerabilitiesReport from "@/components/shared/report/DossierVulnerabilities";
import DossierStrikePlanReport from "@/components/shared/report/DossierStrikePlan";

interface DossierPanelProps {
  dossier: IntelDossier | CompetitorAnalysisReport;
  visible: boolean;
  onClose: () => void;
  onDownloadDossier?: () => void;
  variant: "codec" | "report";
}

const TABS_CONFIG = {
  codec: [
    { id: "matrix", label: "COMPETITOR MATRIX", icon: "◈" },
    { id: "vulns", label: "VULNERABILITY MAP", icon: "◆" },
    { id: "strike", label: "STRIKE PLAN", icon: "▶" },
  ],
  report: [
    { id: "matrix", label: "COMPETITOR MATRIX", icon: "◈" },
    { id: "vulns", label: "CHALLENGE AREAS", icon: "◆" },
    { id: "strike", label: "STRATEGIC RECOMMENDATIONS", icon: "▶" },
  ],
};

type TabId = "matrix" | "vulns" | "strike";

const DossierPanel = ({ dossier, visible, onClose, onDownloadDossier, variant }: DossierPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabId>("matrix");

  const tabsConfig = TABS_CONFIG[variant];
  const panelHeaderClass = variant === "codec" ? "dossier-header" : "report-header";
  const borderClass = variant === "codec" ? "codec-border" : "report-border";
  const tabActiveClass = variant === "codec" ? "dossier-tab-active" : "report-tab-active";
  const tabInactiveClass = variant === "codec" ? "dossier-tab" : "report-tab";
  const targetLabel = variant === "codec" ? "TARGET" : "SUBJECT";

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-background/80"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            className="fixed right-0 top-0 bottom-0 z-30 w-full sm:w-[500px] md:w-[600px] bg-background border-l border-border overflow-hidden flex flex-col"
            style={{ boxShadow: "-4px 0 30px hsl(153 90% 61% / 0.15)" }}
          >
            {/* Header */}
            <div className={`${panelHeaderClass} px-5 py-4 flex-shrink-0`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-destructive tracking-[0.3em] font-bold">
                  {dossier.classification}
                </div>
                <div className="flex items-center gap-2">
                  {onDownloadDossier && (
                    <button
                      onClick={onDownloadDossier}
                      className={`text-muted-foreground hover:text-foreground hover:text-glow text-xs tracking-widest transition-colors px-2 py-1 ${borderClass}`}
                    >
                      ▼ DOWNLOAD
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className={`text-muted-foreground hover:text-foreground text-xs tracking-widest transition-colors px-2 py-1 ${borderClass}`}
                  >
                    ✕ CLOSE
                  </button>
                </div>
              </div>

              <div className="text-lg font-bold text-foreground text-glow-strong tracking-wider">
                {dossier.operationName}
              </div>

              <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground tracking-wider">
                <span>{targetLabel}: {dossier.targetCompany}</span>
                <span>DATE: {new Date(dossier.dateCompiled).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 py-3 flex-shrink-0">
              {tabsConfig.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`flex-1 px-2 py-2 text-[10px] tracking-widest font-bold transition-all ${
                    activeTab === tab.id
                      ? `${tabActiveClass} text-foreground text-glow`
                      : `${tabInactiveClass} text-muted-foreground`
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              <AnimatePresence mode="wait">
                {activeTab === "matrix" && (
                  <motion.div
                    key="matrix"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {variant === "codec" ? (
                      <DossierMatrixCodec entries={(dossier as IntelDossier).matrix} target={dossier.targetCompany} />
                    ) : (
                      <DossierMatrixReport entries={(dossier as CompetitorAnalysisReport).matrix} target={dossier.targetCompany} />
                    )}
                  </motion.div>
                )}
                {activeTab === "vulns" && (
                  <motion.div
                    key="vulns"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {variant === "codec" ? (
                      <DossierVulnerabilitiesCodec entries={(dossier as IntelDossier).vulnerabilities} />
                    ) : (
                      <DossierVulnerabilitiesReport entries={(dossier as CompetitorAnalysisReport).challenges} />
                    )}
                  </motion.div>
                )}
                {activeTab === "strike" && (
                  <motion.div
                    key="strike"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {variant === "codec" ? (
                      <DossierStrikePlanCodec entries={(dossier as IntelDossier).strikePlan} />
                    ) : (
                      <DossierStrikePlanReport entries={(dossier as CompetitorAnalysisReport).strikePlan} />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DossierPanel;
