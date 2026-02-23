import { motion, AnimatePresence } from "framer-motion";

interface SignalLostOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}

const SignalLostOverlay = ({ visible, onDismiss }: SignalLostOverlayProps) => {
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
          style={{
            background: "rgba(0,0,0,0.92)",
          }}
        >
          {/* Static noise pattern */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
              backgroundSize: "128px 128px",
              animation: "noiseShift 0.1s steps(3) infinite",
            }}
          />

          {/* Horizontal interference lines */}
          <div className="absolute inset-0 overflow-hidden opacity-30">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-full bg-foreground"
                style={{
                  height: `${1 + Math.random() * 3}px`,
                  top: `${Math.random() * 100}%`,
                  opacity: 0.3 + Math.random() * 0.5,
                }}
                animate={{
                  top: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
                  opacity: [0.2, 0.6, 0.1],
                }}
                transition={{
                  duration: 0.3 + Math.random() * 0.4,
                  repeat: Infinity,
                  repeatType: "mirror",
                }}
              />
            ))}
          </div>

          {/* Main error message */}
          <motion.div
            className="relative z-10 text-center"
            animate={{ opacity: [1, 0.7, 1, 0.5, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <div className="text-2xl sm:text-4xl font-bold text-destructive tracking-widest mb-4"
              style={{ textShadow: "0 0 20px hsl(0 84% 60% / 0.8), 0 0 40px hsl(0 84% 60% / 0.4)" }}
            >
              ⚠ CONNECTION INTERRUPTED
            </div>
            <div className="text-sm text-muted-foreground tracking-wider mb-2">
              SIGNAL LOST — FREQUENCY 140.85
            </div>
            <div className="text-xs text-muted-foreground tracking-wider mb-6">
              CAUSE: ENEMY INTERFERENCE / SERVER TIMEOUT
            </div>
            <div className="text-xs text-foreground tracking-widest animate-pulse-glow">
              [ CLICK TO RETRY TRANSMISSION ]
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SignalLostOverlay;
