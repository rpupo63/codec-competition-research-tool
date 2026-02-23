import { useState, useEffect, useCallback } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  onTick?: () => void;
}

const TypewriterText = ({ text, speed = 25, onComplete, onTick }: TypewriterTextProps) => {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setDisplayedText("");
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
        onTick?.();
      }, speed);
      return () => clearTimeout(timer);
    } else if (currentIndex === text.length && text.length > 0) {
      onComplete?.();
    }
  }, [currentIndex, text, speed, onComplete, onTick]);

  return (
    <span>
      {displayedText}
      {currentIndex < text.length && (
        <span className="animate-cursor-blink text-foreground">▌</span>
      )}
    </span>
  );
};

export default TypewriterText;
