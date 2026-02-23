import { Plus, MessageSquare, Trash2, FolderKanban } from "lucide-react";
import { useChatSession } from "@/contexts/ChatSessionContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavLink } from "react-router-dom";

function groupSessionsByDate(
  sessions: { id: string; title: string; createdAt: number }[],
) {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const yesterdayMs = todayMs - 86_400_000;
  const weekMs = todayMs - 7 * 86_400_000;

  const groups: { label: string; items: typeof sessions }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const s of sessions) {
    if (s.createdAt >= todayMs) groups[0].items.push(s);
    else if (s.createdAt >= yesterdayMs) groups[1].items.push(s);
    else if (s.createdAt >= weekMs) groups[2].items.push(s);
    else groups[3].items.push(s);
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function ChatSidebar() {
  const {
    sessions,
    activeSessionId,
    createSession,
    switchSession,
    deleteSession,
  } = useChatSession();

  const groups = groupSessionsByDate(sessions);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <button
          onClick={createSession}
          className="flex items-center gap-2 w-full rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors tracking-wider"
        >
          <Plus className="w-4 h-4" />
          <span>NEW OPERATION</span>
        </button>
      </SidebarHeader>

      <SidebarGroup>
        <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50">
          OPERATIONS
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="All Operations">
                <NavLink to="/operations" className="w-full">
                  <FolderKanban className="w-4 h-4 shrink-0" />
                  <span className="truncate">All Operations</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      isActive={session.id === activeSessionId}
                      onClick={() => switchSession(session.id)}
                      tooltip={session.title}
                      className="text-xs tracking-wide"
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span className="truncate">{session.title}</span>
                    </SidebarMenuButton>
                    {sessions.length > 1 && (
                      <SidebarMenuAction
                        showOnHover
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className="text-sidebar-foreground/40 hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </SidebarMenuAction>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
