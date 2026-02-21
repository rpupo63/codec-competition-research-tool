import TypewriterText from "./TypewriterText";

interface ChatMessageProps {
  sender: string;
  text: string;
  isNew?: boolean;
  isReasoning?: boolean;
  reasoningStatus?: 'pending' | 'complete';
  reasoningSummary?: string;
  onComplete?: () => void;
  onTick?: () => void;
}

const ChatMessage = ({ sender, text, isNew = false, isReasoning = false, reasoningStatus, reasoningSummary, onComplete, onTick }: ChatMessageProps) => {
  const isUser = sender === "SNAKE";
  const isColonel = sender === "COLONEL";
  const isIntel = sender === "INTEL";

  if (isReasoning) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="border-l-2 border-border pl-4 py-2">
            <span className="text-sm text-muted-foreground italic leading-relaxed">
              {reasoningStatus === "complete" ? "✔ " : "⏳ "}
              {isNew ? (
                <TypewriterText text={text} speed={15} onComplete={onComplete} onTick={onTick} />
              ) : (
                text
              )}
            </span>
            {reasoningSummary && reasoningStatus === "complete" && (
              <div className="mt-1.5 text-xs text-muted-foreground/60 leading-relaxed tracking-wide">
                └ {reasoningSummary}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="bg-accent/30 border border-border rounded-2xl rounded-br-sm px-4 py-3">
            <p className="text-sm leading-relaxed text-foreground/80">
              {isNew ? (
                <TypewriterText text={text} speed={25} onComplete={onComplete} onTick={onTick} />
              ) : (
                text
              )}
            </p>
          </div>
          <div className="text-[10px] text-muted-foreground/50 tracking-widest mt-1.5 text-right pr-1">
            SNAKE
          </div>
        </div>
      </div>
    );
  }

  if (isIntel) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="bg-secondary/50 border border-border/60 rounded-lg px-4 py-2.5">
            <span className="text-[10px] text-foreground/50 tracking-[0.2em] uppercase">INTEL</span>
            <p className="text-sm leading-relaxed text-foreground mt-1">
              {isNew ? (
                <TypewriterText text={text} speed={25} onComplete={onComplete} onTick={onTick} />
              ) : (
                text
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] sm:max-w-[75%]">
        {isColonel && (
          <div className="text-[10px] text-foreground/50 text-glow tracking-[0.2em] uppercase mb-1.5 pl-1">
            COLONEL
          </div>
        )}
        <div className="px-1">
          <p className="text-sm leading-relaxed text-foreground">
            {isNew ? (
              <TypewriterText text={text} speed={25} onComplete={onComplete} onTick={onTick} />
            ) : (
              text
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
