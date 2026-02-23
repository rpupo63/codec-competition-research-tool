import CodecScreen from "@/components/codec/CodecScreen";
import { useChatSession } from "@/contexts/ChatSessionContext";

const Index = () => {
  const { activeSessionId, updateSessionTitle, isLoading, setIsLoading } = useChatSession();

  return (
    <CodecScreen
      key={activeSessionId}
      sessionId={activeSessionId}
      onFirstMessage={(msg) => {
        const title = msg.length > 40 ? msg.slice(0, 40) + "..." : msg;
        updateSessionTitle(activeSessionId, title);
      }}
      onSessionTitleUpdate={(title) => {
        // Backend resolved the company name from dossier — use it as the operation name
        updateSessionTitle(activeSessionId, title);
      }}
      isLoading={isLoading}
      setIsLoading={setIsLoading}
    />
  );
};

export default Index;
