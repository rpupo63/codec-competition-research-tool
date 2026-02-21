import { motion, AnimatePresence } from "framer-motion";

export type ErrorType = 'company_not_found' | 'no_competitors' | 'system_failure';

interface CodecErrorDialogProps {
  visible: boolean;
  errorType: ErrorType | null;
  companyName?: string;
  onDismiss: () => void;
}

const ERROR_CONFIG: Record<ErrorType, { title: string; icon: string; color: string; shadow: string }> = {
  company_not_found: {
    title: "TARGET NOT FOUND",
    icon: "⊘",
    color: "text-foreground",
    shadow: "0 0 20px hsl(153 90% 61% / 0.6)",
  },
  no_competitors: {
    title: "NO HOSTILES DETECTED",
    icon: "◇",
    color: "text-foreground",
    shadow: "0 0 20px hsl(45 90% 55% / 0.6)",
  },
  system_failure: {
    title: "SYSTEM FAILURE",
    icon: "⚠",
    color: "text-destructive",
    shadow: "0 0 20px hsl(0 84% 60% / 0.8), 0 0 40px hsl(0 84% 60% / 0.4)",
  },
};

const CodecErrorDialog = ({ visible, errorType, companyName, onDismiss }: CodecErrorDialogProps) => {
  if (!errorType) return null;
  const config = ERROR_CONFIG[errorType];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-40 flex items-center justify-center cursor-pointer"
          onClick={onDismiss}
          style={{ background: "rgba(0,0,0,0.88)" }}
        >
          {/* Interference lines for system_failure */}
          {errorType === "system_failure" && (
            <div className="absolute inset-0 overflow-hidden opacity-20">
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-full bg-destructive"
                  style={{
                    height: `${1 + Math.random() * 2}px`,
                    top: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    top: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
                    opacity: [0.3, 0.7, 0.2],
                  }}
                  transition={{
                    duration: 0.2 + Math.random() * 0.3,
                    repeat: Infinity,
                    repeatType: "mirror",
                  }}
                />
              ))}
            </div>
          )}

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative z-10 max-w-md w-full mx-4 p-6 bg-background codec-border"
          >
            {/* Icon */}
            <motion.div
              className={`text-4xl ${config.color} text-center mb-4`}
              style={{ textShadow: config.shadow }}
              animate={
                errorType === "system_failure"
                  ? { opacity: [1, 0.5, 1, 0.3, 1] }
                  : { opacity: [0.7, 1, 0.7] }
              }
              transition={{ duration: errorType === "system_failure" ? 0.6 : 2, repeat: Infinity }}
            >
              {config.icon}
            </motion.div>

            {/* Title */}
            <div
              className={`text-lg font-bold ${config.color} text-center tracking-widest mb-4`}
              style={{ textShadow: config.shadow }}
            >
              {config.title}
            </div>

            {/* Body */}
            <div className="space-y-2 text-sm text-center mb-6">
              {errorType === "company_not_found" && (
                <>
                  <p className="text-foreground">
                    Snake, we've swept every frequency.{" "}
                    {companyName && (
                      <span className="text-glow-strong font-bold">"{companyName.toUpperCase()}"</span>
                    )}{" "}
                    doesn't match any entity in our databases.
                  </p>
                  <p className="text-muted-foreground text-xs tracking-wider mt-2">
                    ERROR CODE: INTEL-404 — NO MATCHING RECORDS
                  </p>
                  <p className="text-muted-foreground text-xs tracking-wider">
                    The target may be using an alias, or the intel is outdated. Try a different designation.
                  </p>
                </>
              )}

              {errorType === "no_competitors" && (
                <>
                  <p className="text-foreground">
                    We've confirmed the existence of{" "}
                    {companyName && (
                      <span className="text-glow-strong font-bold">"{companyName.toUpperCase()}"</span>
                    )}
                    , but our reconnaissance turned up zero active hostiles in their sector.
                  </p>
                  <p className="text-muted-foreground text-xs tracking-wider mt-2">
                    STATUS: INTEL-204 — TARGET LOCATED / NO COMPETITORS
                  </p>
                  <p className="text-muted-foreground text-xs tracking-wider">
                    The company may operate in a niche market, or competitors are below our detection threshold.
                  </p>
                </>
              )}

              {errorType === "system_failure" && (
                <>
                  <p className="text-destructive">
                    Critical failure across all systems. The entire intelligence pipeline has gone dark.
                  </p>
                  <p className="text-muted-foreground text-xs tracking-wider mt-2">
                    ERROR CODE: SYS-500 — TOTAL SYSTEM FAILURE
                  </p>
                  <p className="text-muted-foreground text-xs tracking-wider">
                    All nodes unresponsive. Possible enemy countermeasure. Recommend full system restart.
                  </p>
                </>
              )}
            </div>

            {/* Dismiss */}
            <div className="text-center">
              <span className="text-xs text-muted-foreground tracking-widest animate-pulse-glow">
                [ CLICK ANYWHERE TO DISMISS ]
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CodecErrorDialog;
