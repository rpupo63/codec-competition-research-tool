import CodecScreen from "@/components/codec/CodecScreen";
import { useChatSession } from "@/contexts/ChatSessionContext";

const Index = () => {
  const { activeSessionId, updateSessionTitle } = useChatSession();

  return (
    <CodecScreen
      key={activeSessionId}
      sessionId={activeSessionId}
      onFirstMessage={(msg) => {
        const title = msg.length > 40 ? msg.slice(0, 40) + "..." : msg;
        updateSessionTitle(activeSessionId, title);
      }}
    />
  );
};

export default Index;
