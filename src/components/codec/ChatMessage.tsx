import TypewriterText from "./TypewriterText";

interface ChatMessageProps {
  sender: string;
  text: string;
  isNew?: boolean;
  isReasoning?: boolean;
  reasoningStatus?: 'pending' | 'complete';
  onComplete?: () => void;
}

const ChatMessage = ({ sender, text, isNew = false, isReasoning = false, reasoningStatus, onComplete }: ChatMessageProps) => {
  const senderColor = sender === "SNAKE" ? "text-muted-foreground" : "text-foreground";

  const statusIndicator = isReasoning
    ? reasoningStatus === "complete"
      ? "✔ "
      : "⏳ "
    : "";

  return (
    <div className={`mb-3 ${isReasoning ? "pl-4 border-l border-border" : ""}`}>
      <span className={`${senderColor} text-glow text-xs tracking-widest`}>
        {sender}:&nbsp;
      </span>
      <span className={`text-sm ${isReasoning ? "text-muted-foreground italic" : "text-foreground"}`}>
        {statusIndicator}
        {isNew ? (
          <TypewriterText text={text} speed={isReasoning ? 15 : 25} onComplete={onComplete} />
        ) : (
          text
        )}
      </span>
    </div>
  );
};

export default ChatMessage;
