import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { IntelDossier } from "@/types/codec";
import DossierMatrix from "./DossierMatrix";
import DossierVulnerabilities from "./DossierVulnerabilities";
import DossierStrikePlan from "./DossierStrikePlan";

interface IntelDossierPanelProps {
  dossier: IntelDossier;
  visible: boolean;
  onClose: () => void;
  onDownloadDossier?: () => void;
}

const TABS = [
  { id: "matrix", label: "COMPETITOR MATRIX", icon: "◈" },
  { id: "vulns", label: "VULNERABILITY MAP", icon: "◆" },
  { id: "strike", label: "STRIKE PLAN", icon: "▶" },
] as const;

type TabId = typeof TABS[number]["id"];

const IntelDossierPanel = ({ dossier, visible, onClose, onDownloadDossier }: IntelDossierPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabId>("matrix");

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
            <div className="dossier-header px-5 py-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-destructive tracking-[0.3em] font-bold">
                  {dossier.classification}
                </div>
                <div className="flex items-center gap-2">
                  {onDownloadDossier && (
                    <button
                      onClick={onDownloadDossier}
                      className="text-muted-foreground hover:text-foreground hover:text-glow text-xs tracking-widest transition-colors px-2 py-1 codec-border"
                    >
                      ▼ DOWNLOAD
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground text-xs tracking-widest transition-colors px-2 py-1 codec-border"
                  >
                    ✕ CLOSE
                  </button>
                </div>
              </div>

              <div className="text-lg font-bold text-foreground text-glow-strong tracking-wider">
                {dossier.operationName}
              </div>

              <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground tracking-wider">
                <span>TARGET: {dossier.targetCompany}</span>
                <span>DATE: {new Date(dossier.dateCompiled).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 py-3 flex-shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-2 py-2 text-[10px] tracking-widest font-bold transition-all ${
                    activeTab === tab.id
                      ? "dossier-tab-active text-foreground text-glow"
                      : "dossier-tab text-muted-foreground"
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
                    <DossierMatrix entries={dossier.matrix} target={dossier.targetCompany} />
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
                    <DossierVulnerabilities entries={dossier.vulnerabilities} />
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
                    <DossierStrikePlan entries={dossier.strikePlan} />
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

export default IntelDossierPanel;
