import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ChatSessionProvider } from "@/contexts/ChatSessionContext";
import ChatSidebar from "./ChatSidebar";

export default function AppLayout() {
  return (
    <ChatSessionProvider>
      <SidebarProvider defaultOpen={true}>
        <ChatSidebar />
        <SidebarInset className="relative">
          <SidebarTrigger className="absolute top-3 left-3 z-20 text-foreground/60 hover:text-foreground" />
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </ChatSessionProvider>
  );
}
