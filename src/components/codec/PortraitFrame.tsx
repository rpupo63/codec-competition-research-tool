import { motion } from "framer-motion";

interface PortraitFrameProps {
  image: string;
  name: string;
  isSpeaking?: boolean;
}

const PortraitFrame = ({ image, name, isSpeaking = false }: PortraitFrameProps) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className="portrait-frame w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-sm bg-muted"
        animate={isSpeaking ? { opacity: [0.85, 1, 0.9, 1] } : { opacity: 1 }}
        transition={isSpeaking ? { duration: 0.3, repeat: Infinity, repeatType: "mirror" } : {}}
      >
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
          style={{ filter: "contrast(1.1) brightness(0.9)" }}
        />
      </motion.div>
      <span className="text-xs sm:text-sm text-foreground text-glow tracking-widest uppercase">
        {name}
      </span>
    </div>
  );
};

export default PortraitFrame;
