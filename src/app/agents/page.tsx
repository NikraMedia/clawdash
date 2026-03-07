"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { useGatewayHealth } from "@/hooks/use-gateway-health";
import { unwrapSessions, unwrapMessages } from "@/lib/gateway/unwrap";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Send,
  Loader2,
  X,
  MessageSquarePlus,
  ArrowLeft,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Agent metadata (role/emoji mapping for the 12 agents)
const AGENT_META: Record<string, { role: string; color: string }> = {
  manager: { role: "COO", color: "indigo" },
  steve: { role: "CEO", color: "amber" },
  gary: { role: "Marketing", color: "pink" },
  jimmy: { role: "Content", color: "orange" },
  neil: { role: "SEO", color: "green" },
  nate: { role: "Analytics", color: "cyan" },
  alex: { role: "Sales", color: "red" },
  warren: { role: "Finance", color: "emerald" },
  tom: { role: "Tax", color: "yellow" },
  robert: { role: "Legal", color: "purple" },
  tiago: { role: "Notion", color: "blue" },
  pieter: { role: "Tech", color: "zinc" },
};

const COLOR_MAP: Record<string, string> = {
  indigo: "from-indigo-500/20 to-indigo-600/5 border-indigo-500/30 text-indigo-400",
  amber: "from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-400",
  pink: "from-pink-500/20 to-pink-600/5 border-pink-500/30 text-pink-400",
  orange: "from-orange-500/20 to-orange-600/5 border-orange-500/30 text-orange-400",
  green: "from-green-500/20 to-green-600/5 border-green-500/30 text-green-400",
  cyan: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30 text-cyan-400",
  red: "from-red-500/20 to-red-600/5 border-red-500/30 text-red-400",
  emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400",
  yellow: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/30 text-yellow-400",
  purple: "from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-400",
  blue: "from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400",
  zinc: "from-zinc-500/20 to-zinc-600/5 border-zinc-500/30 text-zinc-400",
};

interface AgentData {
  id: string;
  name?: string;
  emoji?: string;
  model?: string;
}

interface ChatMsg {
  role: string;
  content?: string | Array<{ type: string; text?: string }> | Record<string, unknown>;
  text?: string;
  ts?: number;
}

function getTextContent(msg: ChatMsg): string {
  if (msg.text) return msg.text;
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text!)
      .join("\n");
  }
  return "";
}

// ── Agent Card ──────────────────────────────────────────────────────────

function AgentCard({
  agent,
  isSelected,
  onClick,
  sessionCount,
}: {
  agent: AgentData;
  isSelected: boolean;
  onClick: () => void;
  sessionCount: number;
}) {
  const meta = AGENT_META[agent.id] ?? { role: "Agent", color: "zinc" };
  const colors = COLOR_MAP[meta.color] ?? COLOR_MAP.zinc;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-200 bg-gradient-to-br hover:scale-[1.02] active:scale-[0.98]",
        colors,
        isSelected
          ? "ring-2 ring-white/20 shadow-lg"
          : "hover:shadow-md opacity-80 hover:opacity-100"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{agent.emoji || "🤖"}</span>
          <span className="font-semibold text-zinc-100 text-sm">
            {agent.name ?? agent.id}
          </span>
        </div>
        <Circle
          className={cn(
            "h-2.5 w-2.5 fill-current",
            sessionCount > 0 ? "text-green-400" : "text-zinc-600"
          )}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider opacity-70">
          {meta.role}
        </span>
        <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[120px]">
          {agent.model ? agent.model.split("/").pop() : "—"}
        </span>
      </div>
      {sessionCount > 0 && (
        <span className="text-[10px] text-zinc-500">
          {sessionCount} session{sessionCount !== 1 ? "s" : ""}
        </span>
      )}
    </button>
  );
}

// ── Chat Panel ──────────────────────────────────────────────────────────

function ChatPanel({
  agent,
  onClose,
}: {
  agent: AgentData;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null);
  const [mutError, setMutError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isOffline, hasMethod } = useGatewayHealth();
  const canSend = !isOffline && hasMethod("chat.send");

  // Get sessions for this agent
  const { data: sessionsData } = useQuery({
    ...trpc.sessions.list.queryOptions({
      agentId: agent.id,
      includeDerivedTitles: true,
      includeLastMessage: true,
    }),
    refetchInterval: 5000,
  });

  const sessions = unwrapSessions(sessionsData);
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [sessions]
  );

  // Auto-select most recent session
  useEffect(() => {
    if (!activeSessionKey && sortedSessions.length > 0) {
      setActiveSessionKey(sortedSessions[0].key);
    }
  }, [sortedSessions, activeSessionKey]);

  // Get chat history for active session
  const { data: historyData, isLoading: historyLoading } = useQuery({
    ...trpc.sessions.history.queryOptions({
      sessionKey: activeSessionKey ?? "",
      limit: 100,
    }),
    enabled: !!activeSessionKey,
    refetchInterval: 3000,
  });

  const messages_list = unwrapMessages(historyData) as ChatMsg[];

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages_list.length]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, []);
  useEffect(() => { autoResize(); }, [message, autoResize]);

  const sendMutation = useMutation(
    trpc.sessions.send.mutationOptions({
      onSuccess: () => {
        setMessage("");
        setMutError(null);
        queryClient.invalidateQueries({ queryKey: trpc.sessions.history.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.sessions.list.queryKey() });
      },
      onError: (err) => setMutError(err.message ?? "Failed to send"),
    })
  );

  const handleSend = async () => {
    if (isSendingRef.current || !message.trim() || !canSend || sendMutation.isPending) return;
    isSendingRef.current = true;

    // If no active session, create a new one
    const sessionKey = activeSessionKey ?? `agent:${agent.id}:${Date.now()}`;
    if (!activeSessionKey) setActiveSessionKey(sessionKey);

    try {
      sendMutation.mutate({
        sessionKey,
        message: message.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
    } finally {
      isSendingRef.current = false;
    }
  };

  const handleNewChat = () => {
    const newKey = `agent:${agent.id}:${Date.now()}`;
    setActiveSessionKey(newKey);
    setMessage("");
  };

  const meta = AGENT_META[agent.id] ?? { role: "Agent", color: "zinc" };

  return (
    <div className="flex h-full flex-col border-l border-zinc-800/80 bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-lg">{agent.emoji || "🤖"}</span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {agent.name ?? agent.id}
            </h2>
            <p className="text-[11px] text-zinc-500">{meta.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleNewChat}
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
            New Chat
          </Button>
          <button
            onClick={onClose}
            className="hidden md:flex p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Session Tabs */}
      {sortedSessions.length > 1 && (
        <div className="flex items-center gap-1 border-b border-zinc-800/40 px-3 py-1.5 overflow-x-auto shrink-0">
          {sortedSessions.slice(0, 8).map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSessionKey(s.key)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                activeSessionKey === s.key
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              {s.label || s.derivedTitle || s.key.split(":").pop()?.slice(0, 8) || "Chat"}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-3 p-4">
          {historyLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
            </div>
          )}
          {!historyLoading && messages_list.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bot className="h-10 w-10 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">
                Start a conversation with {agent.name ?? agent.id}
              </p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Type a message below to begin
              </p>
            </div>
          )}
          {messages_list.map((msg, i) => {
            const text = getTextContent(msg);
            if (!text) return null;
            const isUser = msg.role === "user";

            return (
              <div
                key={i}
                className={cn(
                  "flex",
                  isUser ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                    isUser
                      ? "bg-indigo-600/90 text-white"
                      : "bg-zinc-800/80 text-zinc-200"
                  )}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <div className="prose prose-invert prose-sm max-w-none [&>*:last-child]:mb-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {text}
                      </ReactMarkdown>
                    </div>
                  )}
                  {msg.ts && (
                    <p className={cn(
                      "text-[10px] mt-1.5",
                      isUser ? "text-indigo-200/50" : "text-zinc-500"
                    )}>
                      {new Date(msg.ts).toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-zinc-800/60 px-4 py-3 shrink-0">
        {mutError && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5">
            <span className="text-[11px] text-red-400 flex-1">{mutError}</span>
            <button onClick={() => setMutError(null)} className="text-zinc-500 hover:text-zinc-300">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey && !sendMutation.isPending) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={canSend ? `Message ${agent.name ?? agent.id}...` : "Gateway disconnected..."}
            disabled={!canSend || sendMutation.isPending}
            className="min-h-[40px] max-h-[150px] resize-none border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-indigo-500/50 rounded-xl"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || !canSend || sendMutation.isPending}
            size="sm"
            className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-all"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
  const trpc = useTRPC();

  const { data: agentsData, isLoading } = useQuery(trpc.agents.list.queryOptions());
  const agents: AgentData[] = (agentsData as { agents?: AgentData[] })?.agents ?? [];

  // Get all sessions to count per agent
  const { data: sessionsData } = useQuery(
    trpc.sessions.list.queryOptions({ limit: 1000 })
  );
  const allSessions = unwrapSessions(sessionsData);

  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of allSessions) {
      // session key format: agent:<agentId>:<timestamp>
      const parts = s.key.split(":");
      if (parts[0] === "agent" && parts[1]) {
        counts[parts[1]] = (counts[parts[1]] ?? 0) + 1;
      }
    }
    return counts;
  }, [allSessions]);

  // Sort agents: known order first
  const knownOrder = Object.keys(AGENT_META);
  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const ai = knownOrder.indexOf(a.id);
      const bi = knownOrder.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [agents]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Agent Grid (left side) */}
      <div
        className={cn(
          "flex flex-col overflow-hidden transition-all duration-300",
          selectedAgent ? "w-1/2 xl:w-2/5" : "w-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4 shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Agents</h1>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {agents.length} agents · Click to chat
            </p>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-3",
                  selectedAgent
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                )}
              >
                {sortedAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isSelected={selectedAgent?.id === agent.id}
                    onClick={() =>
                      setSelectedAgent(
                        selectedAgent?.id === agent.id ? null : agent
                      )
                    }
                    sessionCount={sessionCounts[agent.id] ?? 0}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Panel (right side) */}
      {selectedAgent && (
        <div className="flex-1 min-w-0">
          <ChatPanel
            key={selectedAgent.id}
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
          />
        </div>
      )}
    </div>
  );
}
