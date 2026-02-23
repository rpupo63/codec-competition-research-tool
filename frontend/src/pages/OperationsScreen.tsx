import React, { useState, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useChatSession } from "@/contexts/ChatSessionContext";
import { Input } from "@/components/ui/input";
import { FolderKanban } from "lucide-react";

const OperationsScreen: React.FC = () => {
  const { sessions, isLoading } = useChatSession();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) =>
      session.title.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.createdAt - a.createdAt); // Sort by most recent first
  }, [sessions, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Loading operations...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      <h1 className="text-2xl font-bold mb-4">All Operations</h1>
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search operations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <p className="text-center text-gray-500">No operations found.</p>
        ) : (
          <ul className="space-y-2">
            {filteredSessions.map((session) => (
              <li key={session.id}>
                <NavLink
                  to={`/operations/${session.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 p-3 rounded-md transition-colors ${
                      isActive ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`
                  }
                >
                  <FolderKanban className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{session.title}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(session.createdAt).toLocaleDateString()}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default OperationsScreen;
