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
  Brain,
  Zap,
  BookOpen,
  Clock,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HierarchyView } from "@/components/agents/hierarchy-view";
import { RoundtableModal } from "@/components/agents/roundtable";
import { Users } from "lucide-react";

/* ─── Types ─── */
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

// Map display IDs to openclaw agent IDs
const AGENT_ID_MAP: Record<string, string> = {
  steve: "ceo", gary: "marketing", jimmy: "content", neil: "seo",
  nate: "analytics", alex: "sales", warren: "finance", tom: "tax",
  robert: "legal", tiago: "notion", pieter: "tech", manager: "main",
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
    return msg.content.filter((b) => b.type === "text" && b.text).map((b) => b.text!).join("\n");
  }
  return "";
}

type PanelTab = "chat" | "memory" | "skills" | "cron";

/* ─── Toast ─── */
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={cn(
      "fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-top-2",
      type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
    )}>
      {message}
    </div>
  );
}

/* ─── Chat Panel ─── */
function ChatPanel({ agent, onClose }: { agent: AgentData; onClose: () => void }) {
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
  const realId = AGENT_ID_MAP[agent.id] ?? agent.id;

  const { data: sessionsData } = useQuery({
    ...trpc.sessions.list.queryOptions({ agentId: realId, includeDerivedTitles: true, includeLastMessage: true }),
    refetchInterval: 5000,
  });
  const sessions = unwrapSessions(sessionsData);
  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)), [sessions]);

  useEffect(() => {
    if (!activeSessionKey && sortedSessions.length > 0) setActiveSessionKey(sortedSessions[0].key);
  }, [sortedSessions, activeSessionKey]);

  const { data: historyData, isLoading: historyLoading } = useQuery({
    ...trpc.sessions.history.queryOptions({ sessionKey: activeSessionKey ?? "", limit: 100 }),
    enabled: !!activeSessionKey,
    refetchInterval: 3000,
  });
  const messages_list = unwrapMessages(historyData) as ChatMsg[];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages_list.length]);

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
    const sessionKey = activeSessionKey ?? `agent:${realId}:${Date.now()}`;
    if (!activeSessionKey) setActiveSessionKey(sessionKey);
    try {
      sendMutation.mutate({ sessionKey, message: message.trim(), idempotencyKey: crypto.randomUUID() });
    } finally {
      isSendingRef.current = false;
    }
  };

  const meta = AGENT_META[agent.id] ?? { role: "Agent", color: "zinc" };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg">{agent.emoji || "\uD83E\uDD16"}</span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{agent.name ?? agent.id}</h2>
            <p className="text-[11px] text-zinc-500">{meta.role} · Chat</p>
          </div>
        </div>
        <Button onClick={() => {
          const newKey = `agent:${realId}:${Date.now()}`;
          setActiveSessionKey(newKey);
          setMessage("");
        }} variant="ghost" size="sm" className="h-7 text-[11px] text-zinc-400">
          <MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> New
        </Button>
      </div>

      {sortedSessions.length > 1 && (
        <div className="flex items-center gap-1 border-b border-zinc-800/40 px-3 py-1.5 overflow-x-auto shrink-0">
          {sortedSessions.slice(0, 8).map((s) => (
            <button key={s.key} onClick={() => setActiveSessionKey(s.key)} className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
              activeSessionKey === s.key ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            )}>
              {s.label || s.derivedTitle || s.key.split(":").pop()?.slice(0, 8) || "Chat"}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-3 p-4">
          {historyLoading && <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-zinc-600" /></div>}
          {!historyLoading && messages_list.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bot className="h-10 w-10 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">Start a conversation with {agent.name ?? agent.id}</p>
            </div>
          )}
          {messages_list.map((msg, i) => {
            const text = getTextContent(msg);
            if (!text) return null;
            const isUser = msg.role === "user";
            return (
              <div key={i} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                  isUser ? "bg-indigo-600/90 text-white" : "bg-zinc-800/80 text-zinc-200")}>
                  {isUser ? <p className="whitespace-pre-wrap">{text}</p> : (
                    <div className="prose prose-invert prose-sm max-w-none [&>*:last-child]:mb-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                    </div>
                  )}
                  {msg.ts && <p className={cn("text-[10px] mt-1.5", isUser ? "text-indigo-200/50" : "text-zinc-500")}>
                    {new Date(msg.ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                  </p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-zinc-800/60 px-4 py-3 shrink-0">
        {mutError && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5">
            <span className="text-[11px] text-red-400 flex-1">{mutError}</span>
            <button onClick={() => setMutError(null)} className="text-zinc-500 hover:text-zinc-300"><X className="h-3 w-3" /></button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea ref={textareaRef} value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey && !sendMutation.isPending) { e.preventDefault(); handleSend(); }
            }}
            placeholder={canSend ? `Message ${agent.name ?? agent.id}...` : "Gateway disconnected..."}
            disabled={!canSend || sendMutation.isPending}
            className="min-h-[40px] max-h-[150px] resize-none border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-indigo-500/50 rounded-xl"
          />
          <Button onClick={handleSend} disabled={!message.trim() || !canSend || sendMutation.isPending}
            size="sm" className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40">
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Memory Panel ─── */
function MemoryPanel({ agent, onToast }: { agent: AgentData; onToast: (msg: string, type: "success" | "error") => void }) {
  const trpc = useTRPC();
  const { data, isLoading, refetch } = useQuery({
    ...trpc.memory.getAgentMemory.queryOptions({ agentId: agent.id }),
    refetchInterval: 30000,
  });

  const syncMutation = useMutation(
    trpc.memory.syncAgent.mutationOptions({
      onSuccess: () => onToast("Memory Sync gestartet", "success"),
      onError: (err) => onToast(`Sync fehlgeschlagen: ${err.message}`, "error"),
    })
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Memory - {agent.name ?? agent.id}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => syncMutation.mutate({ agentId: agent.id })} variant="ghost" size="sm"
            disabled={syncMutation.isPending}
            className="h-7 text-[11px] text-zinc-400 hover:text-zinc-200">
            {syncMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Sync Now
          </Button>
          <Button onClick={() => refetch()} variant="ghost" size="sm" className="h-7 text-[11px] text-zinc-400">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-zinc-600" /></div>
        ) : data?.exists ? (
          <div>
            {data.lastModified && (
              <p className="text-[10px] text-zinc-600 mb-3">
                Last modified: {new Date(data.lastModified).toLocaleString("de-DE")}
              </p>
            )}
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.content ?? ""}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Brain className="h-10 w-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">Kein Memory vorhanden</p>
            <p className="text-[11px] text-zinc-600 mt-1">Klick &quot;Sync Now&quot; um Memory zu erstellen</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Skills Panel ─── */
function SkillsPanel({ agent, onToast }: { agent: AgentData; onToast: (msg: string, type: "success" | "error") => void }) {
  const [searchFilter, setSearchFilter] = useState("");
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [marketplaceQuery, setMarketplaceQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const realId = AGENT_ID_MAP[agent.id] ?? agent.id;

  const { data, isLoading, refetch } = useQuery(
    trpc.agents.getSkills.queryOptions({ agentId: realId })
  );

  const { data: searchData, isLoading: searchLoading } = useQuery({
    ...trpc.agents.searchMarketplace.queryOptions({ query: marketplaceQuery }),
    enabled: showMarketplace && marketplaceQuery.length >= 2,
  });

  const toggleMutation = useMutation(
    trpc.agents.toggleSkill.mutationOptions({
      onSuccess: () => { refetch(); },
      onError: (err) => onToast(`Toggle fehlgeschlagen: ${err.message}`, "error"),
    })
  );

  const installMutation = useMutation(
    trpc.agents.installSkill.mutationOptions({
      onSuccess: () => { onToast("Skill installiert!", "success"); refetch(); setShowMarketplace(false); },
      onError: (err) => onToast(`Install fehlgeschlagen: ${err.message}`, "error"),
    })
  );

  const deleteMutation = useMutation(
    trpc.agents.deleteSkill.mutationOptions({
      onSuccess: () => { onToast("Skill gelöscht", "success"); refetch(); setDeleteConfirm(null); },
      onError: (err) => onToast(`Löschen fehlgeschlagen: ${err.message}`, "error"),
    })
  );

  const skills = data?.skills ?? [];
  const systemSkills = skills.filter(s => s.isSystem && (searchFilter === "" || s.name.toLowerCase().includes(searchFilter.toLowerCase()) || s.description.toLowerCase().includes(searchFilter.toLowerCase())));
  const customSkills = skills.filter(s => !s.isSystem && (searchFilter === "" || s.name.toLowerCase().includes(searchFilter.toLowerCase()) || s.description.toLowerCase().includes(searchFilter.toLowerCase())));

  const skillIcons: Record<string, string> = {
    "coding-agent": "💻", github: "🐙", weather: "🌤️", gemini: "✨", browser: "🌐",
    "skill-creator": "🛠️", summarize: "📝", "video-frames": "🎬", clawhub: "📦",
    "gh-issues": "🐛", healthcheck: "🛡️", "openai-whisper": "🎤",
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Skills - {agent.name ?? agent.id}</h2>
        </div>
        <Button onClick={() => refetch()} variant="ghost" size="sm" className="h-7 text-[11px] text-zinc-400">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Search + Marketplace Button */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/40 shrink-0">
        <div className="relative flex-1">
          <input value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Skills durchsuchen..."
            className="w-full bg-zinc-900 border border-zinc-700/60 rounded-lg pl-3 pr-8 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
          {searchFilter && (
            <button onClick={() => setSearchFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button onClick={() => setShowMarketplace(true)} size="sm"
          className="h-8 shrink-0 bg-indigo-600 hover:bg-indigo-500 text-[11px]">
          <Plus className="h-3.5 w-3.5 mr-1" /> Marketplace
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-zinc-600" /></div>
        ) : (
          <div className="space-y-5">
            {/* System Skills */}
            <div>
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                System Skills <span className="text-zinc-600">({systemSkills.length})</span>
              </h3>
              <div className="space-y-1.5">
                {systemSkills.map((skill) => (
                  <div key={skill.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/40 hover:border-zinc-700/60 transition-colors group">
                    <span className="text-base shrink-0 w-6 text-center">{skillIcons[skill.name] ?? "📦"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-zinc-200 font-medium truncate">{skill.name}</p>
                        {skill.version !== "—" && (
                          <span className="text-[9px] text-zinc-600 font-mono">{skill.version}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate">{skill.description}</p>
                    </div>
                    <button
                      onClick={() => toggleMutation.mutate({ agentId: realId, skillName: skill.name, enabled: !skill.isEnabled })}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                        skill.isEnabled ? "bg-emerald-600" : "bg-zinc-700"
                      )}
                    >
                      <span className={cn(
                        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5",
                        skill.isEnabled ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Skills */}
            <div>
              <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Custom Skills <span className="text-zinc-600">({customSkills.length})</span>
              </h3>
              {customSkills.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[11px] text-zinc-600">Keine Custom Skills installiert</p>
                  <p className="text-[10px] text-zinc-700 mt-1">Klick &quot;Marketplace&quot; zum Installieren</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {customSkills.map((skill) => (
                    <div key={skill.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/40 hover:border-zinc-700/60 transition-colors group">
                      <span className="text-base shrink-0 w-6 text-center">{skillIcons[skill.name] ?? "🔧"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-zinc-200 font-medium truncate">{skill.name}</p>
                          {skill.version !== "—" && (
                            <span className="text-[9px] text-zinc-600 font-mono">{skill.version}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 truncate">{skill.description}</p>
                      </div>
                      <button
                        onClick={() => toggleMutation.mutate({ agentId: realId, skillName: skill.name, enabled: !skill.isEnabled })}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                          skill.isEnabled ? "bg-emerald-600" : "bg-zinc-700"
                        )}
                      >
                        <span className={cn(
                          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5",
                          skill.isEnabled ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                        )} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(skill.name)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Marketplace Modal */}
      {showMarketplace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowMarketplace(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-[calc(100%-2rem)] max-w-[500px] max-h-[70vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/60">
              <h2 className="text-base font-semibold text-zinc-100">Marketplace — ClawHub</h2>
              <button onClick={() => setShowMarketplace(false)} className="text-zinc-500 hover:text-zinc-300"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-3 border-b border-zinc-800/40">
              <input
                value={marketplaceQuery}
                onChange={(e) => setMarketplaceQuery(e.target.value)}
                placeholder="Search skills on ClawHub..."
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-5">
              {!marketplaceQuery || marketplaceQuery.length < 2 ? (
                <p className="text-center text-sm text-zinc-600 py-8">Mindestens 2 Zeichen eingeben...</p>
              ) : searchLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-zinc-600" /></div>
              ) : (searchData?.results ?? []).length === 0 ? (
                <p className="text-center text-sm text-zinc-600 py-8">Keine Ergebnisse für &quot;{marketplaceQuery}&quot;</p>
              ) : (
                <div className="space-y-2">
                  {(searchData?.results ?? []).map((r) => (
                    <div key={r.name} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/40">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-200">{r.name}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{r.description}</p>
                      </div>
                      <Button
                        onClick={() => installMutation.mutate({ skillName: r.name })}
                        disabled={installMutation.isPending}
                        size="sm"
                        className="h-7 ml-3 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-[11px]"
                      >
                        {installMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Install"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-[380px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="h-5 w-5 text-red-400" />
              <h2 className="text-base font-semibold text-zinc-100">Skill löschen</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-6">
              Skill <strong className="text-zinc-200">{deleteConfirm}</strong> wirklich löschen?
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setDeleteConfirm(null)} variant="ghost" className="flex-1">Abbrechen</Button>
              <Button onClick={() => deleteMutation.mutate({ skillName: deleteConfirm })}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-500">
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Löschen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Cron Panel ─── */
function CronPanel({ agent, onToast }: { agent: AgentData; onToast: (msg: string, type: "success" | "error") => void }) {
  const trpc = useTRPC();
  const realId = AGENT_ID_MAP[agent.id] ?? agent.id;
  const { data, isLoading } = useQuery({ ...trpc.cron.list.queryOptions({ includeDisabled: true }), refetchInterval: 30000 });

  const jobs = useMemo(() => {
    const allJobs = (Array.isArray(data) ? data : (data as unknown as { jobs?: Array<Record<string, unknown>> })?.jobs ?? []) as Array<{
      id: string; name: string; agentId: string; enabled: boolean; state?: { lastRunAtMs?: number; nextRunAtMs?: number; lastStatus?: string };
    }>;
    return allJobs.filter(j => j.agentId === realId);
  }, [data, realId]);

  const runMutation = useMutation(
    trpc.cron.run.mutationOptions({
      onSuccess: () => onToast("Cron Job gestartet", "success"),
      onError: (err) => onToast(`Fehler: ${err.message}`, "error"),
    })
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-zinc-100">Cron Jobs - {agent.name ?? agent.id}</h2>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-zinc-600" /></div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="h-10 w-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">Keine Cron Jobs</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/40">
                <div>
                  <p className="text-sm text-zinc-200 font-medium">{job.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded",
                      job.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                    )}>{job.enabled ? "Active" : "Disabled"}</span>
                    {job.state?.lastStatus && (
                      <span className={cn("text-[9px]",
                        job.state.lastStatus === "ok" ? "text-emerald-500" : "text-red-400"
                      )}>{job.state.lastStatus}</span>
                    )}
                  </div>
                </div>
                <Button onClick={() => runMutation.mutate({ id: job.id, mode: "force" })}
                  variant="ghost" size="sm" disabled={runMutation.isPending}
                  className="h-7 text-[11px] text-zinc-400 hover:text-zinc-200">
                  <Zap className="h-3 w-3 mr-1" /> Run
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Create Agent Modal ─── */
function CreateAgentModal({ onClose, onToast }: { onClose: () => void; onToast: (msg: string, type: "success" | "error") => void }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("\uD83E\uDD16");
  const [role, setRole] = useState("");
  const [model, setModel] = useState("github-copilot/claude-sonnet-4.6");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    trpc.agents.createAgent.mutationOptions({
      onSuccess: () => {
        onToast(`Agent ${name} erstellt`, "success");
        queryClient.invalidateQueries({ queryKey: trpc.agents.list.queryKey() });
        onClose();
      },
      onError: (err) => onToast(`Fehler: ${err.message}`, "error"),
    })
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-[440px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-zinc-100">Neuer Agent</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="h-5 w-5" /></button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200" placeholder="z.B. Sarah" />
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Emoji</label>
              <input value={emoji} onChange={(e) => setEmoji(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200" />
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Rolle / Beschreibung</label>
              <input value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200" placeholder="z.B. Customer Support" />
            </div>
            <Button onClick={() => setStep(2)} disabled={!name.trim() || !role.trim()} className="w-full bg-indigo-600 hover:bg-indigo-500">
              Weiter
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <label className="text-[11px] text-zinc-400 block mb-1">Model</label>
            <div className="space-y-2">
              {["github-copilot/claude-sonnet-4.6", "github-copilot/claude-opus-4.6", "github-copilot/gpt-4o", "google/gemini-3.1-pro-preview"].map((m) => (
                <button key={m} onClick={() => setModel(m)} className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm font-mono transition-colors border",
                  model === m ? "border-indigo-500 bg-indigo-500/10 text-indigo-300" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-750"
                )}>{m.split("/").pop()}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setStep(1)} variant="ghost" className="flex-1">Zurück</Button>
              <Button onClick={() => setStep(3)} className="flex-1 bg-indigo-600 hover:bg-indigo-500">Weiter</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-zinc-200">Bestätigung</h3>
            <div className="bg-zinc-800 rounded-lg p-4 space-y-2 text-sm">
              <p className="text-zinc-300"><span className="text-zinc-500">Name:</span> {emoji} {name}</p>
              <p className="text-zinc-300"><span className="text-zinc-500">Rolle:</span> {role}</p>
              <p className="text-zinc-300"><span className="text-zinc-500">Model:</span> {model.split("/").pop()}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setStep(2)} variant="ghost" className="flex-1">Zurück</Button>
              <Button onClick={() => createMutation.mutate({ name, emoji, role, model })}
                disabled={createMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Agent erstellen
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Delete Confirm Modal ─── */
function DeleteConfirmModal({ agent, onClose, onToast }: { agent: AgentData; onClose: () => void; onToast: (msg: string, type: "success" | "error") => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const deleteMutation = useMutation(
    trpc.agents.deleteAgent.mutationOptions({
      onSuccess: () => {
        onToast(`Agent ${agent.name ?? agent.id} gelöscht`, "success");
        queryClient.invalidateQueries({ queryKey: trpc.agents.list.queryKey() });
        onClose();
      },
      onError: (err) => onToast(`Fehler: ${err.message}`, "error"),
    })
  );
  const realId = AGENT_ID_MAP[agent.id] ?? agent.id;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-[400px] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="h-5 w-5 text-red-400" />
          <h2 className="text-lg font-semibold text-zinc-100">Agent löschen</h2>
        </div>
        <p className="text-sm text-zinc-400 mb-6">
          Agent <strong className="text-zinc-200">{agent.name ?? agent.id}</strong> wirklich löschen? Alle Memory-Daten werden gelöscht.
        </p>
        <div className="flex gap-2">
          <Button onClick={onClose} variant="ghost" className="flex-1">Abbrechen</Button>
          <Button onClick={() => deleteMutation.mutate({ agentId: realId })}
            disabled={deleteMutation.isPending}
            className="flex-1 bg-red-600 hover:bg-red-500">
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Löschen
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Mobile Agent Card ─── */
function MobileAgentCard({ agent, sessionActivity, onChat }: {
  agent: AgentData;
  sessionActivity: Record<string, number>;
  onChat: (id: string) => void;
}) {
  const meta = AGENT_META[agent.id] ?? { role: "Agent", color: "zinc" };
  const lastActive = sessionActivity[agent.id];
  const isOnline = lastActive && Date.now() - lastActive < 300_000; // 5min
  return (
    <button
      onClick={() => onChat(agent.id)}
      className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4 hover:border-zinc-700 transition-colors text-center"
    >
      <div className="relative">
        <span className="text-2xl">{agent.emoji || "\uD83E\uDD16"}</span>
        <span className={cn(
          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900",
          isOnline ? "bg-emerald-500" : "bg-zinc-600"
        )} />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-200">{agent.name ?? agent.id}</p>
        <p className="text-[10px] text-zinc-500">{meta.role}</p>
      </div>
      <span className="text-[10px] text-indigo-400 flex items-center gap-1">
        <Bot className="h-3 w-3" /> Chat
      </span>
    </button>
  );
}

/* ─── Main Page ─── */
export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>("chat");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteAgent, setDeleteAgent] = useState<AgentData | null>(null);
  const [showRoundtable, setShowRoundtable] = useState(false);
  const [activeRoundtableAgent, setActiveRoundtableAgent] = useState<string | null>(null);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: agentsData, isLoading } = useQuery({ ...trpc.agents.list.queryOptions(), refetchInterval: 30000 });
  const agents: AgentData[] = ((agentsData as { agents?: AgentData[] })?.agents ?? []).map(a => ({
    ...a,
    model: typeof a.model === "object" ? (a.model as { primary?: string })?.primary : a.model,
  }));

  const { data: sessionsData } = useQuery({ ...trpc.sessions.list.queryOptions({ limit: 10000 }), refetchInterval: 30000 });
  const allSessions = unwrapSessions(sessionsData);

  const { data: cronData } = useQuery({ ...trpc.cron.list.queryOptions({ includeDisabled: false }), refetchInterval: 60000 });

  // Session activity: last active timestamp per agent
  const sessionActivity = useMemo(() => {
    const activity: Record<string, number> = {};
    for (const s of allSessions) {
      const parts = s.key.split(":");
      if (parts[0] === "agent" && parts[1] && s.updatedAt) {
        const displayId = Object.entries(AGENT_ID_MAP).find(([, v]) => v === parts[1])?.[0] ?? parts[1];
        activity[displayId] = Math.max(activity[displayId] ?? 0, s.updatedAt);
      }
    }
    return activity;
  }, [allSessions]);

  // Cron counts per agent
  const cronCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const jobs = (Array.isArray(cronData) ? cronData : (cronData as unknown as { jobs?: Array<{ agentId: string }> })?.jobs ?? []) as Array<{ agentId: string }>;
    for (const j of jobs) {
      const displayId = Object.entries(AGENT_ID_MAP).find(([, v]) => v === j.agentId)?.[0] ?? j.agentId;
      counts[displayId] = (counts[displayId] ?? 0) + 1;
    }
    return counts;
  }, [cronData]);

  const showToast = useCallback((msg: string, type: "success" | "error") => setToast({ message: msg, type }), []);

  const handleNodeClick = useCallback((agentId: string | null) => {
    if (!agentId) return;
    // Find from agents list or hardcoded
    const agent = agents.find((a) => a.id === agentId);
    const fallback: AgentData = { id: agentId, name: agentId.charAt(0).toUpperCase() + agentId.slice(1) };
    const target = agent ?? fallback;
    setSelectedAgent((prev) => prev?.id === agentId ? null : target);
    setActiveTab("chat");
  }, [agents]);

  const handleModelChange = useCallback((agentId: string, model: string) => {
    const realId = AGENT_ID_MAP[agentId] ?? agentId;
    // Fire and forget mutation
    fetch("/api/trpc/agents.setModel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { agentId: realId, model } }),
    }).then(() => {
      showToast("Model aktualisiert", "success");
      queryClient.invalidateQueries({ queryKey: trpc.agents.list.queryKey() });
    }).catch(() => showToast("Model-Änderung fehlgeschlagen", "error"));
  }, [showToast, queryClient, trpc]);

  const handleMemoryClick = useCallback((agentId: string) => {
    const agent = agents.find((a) => a.id === agentId) ?? { id: agentId, name: agentId };
    setSelectedAgent(agent);
    setActiveTab("memory");
  }, [agents]);

  const handlePingClick = useCallback((agentId: string) => {
    const realId = AGENT_ID_MAP[agentId] ?? agentId;
    const start = Date.now();
    fetch("/api/trpc/agents.pingAgent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { agentId: realId } }),
    }).then(() => {
      const ms = Date.now() - start;
      showToast(`Ping OK — ${ms}ms`, "success");
    }).catch(() => showToast("Ping fehlgeschlagen", "error"));
  }, [showToast]);

  const handleSkillsClick = useCallback((agentId: string) => {
    const agent = agents.find((a) => a.id === agentId) ?? { id: agentId, name: agentId };
    setSelectedAgent(agent);
    setActiveTab("skills");
  }, [agents]);

  const handleCronClick = useCallback((agentId: string) => {
    const agent = agents.find((a) => a.id === agentId) ?? { id: agentId, name: agentId };
    setSelectedAgent(agent);
    setActiveTab("cron");
  }, [agents]);

  const handleDeleteClick = useCallback((agentId: string) => {
    const agent = agents.find((a) => a.id === agentId) ?? { id: agentId, name: agentId };
    setDeleteAgent(agent);
  }, [agents]);

  const tabs: { id: PanelTab; label: string; icon: typeof Bot }[] = [
    { id: "chat", label: "Chat", icon: Bot },
    { id: "memory", label: "Memory", icon: Brain },
    { id: "skills", label: "Skills", icon: BookOpen },
    { id: "cron", label: "Cron", icon: Clock },
  ];

  return (
    <div className="flex h-full w-full overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {showCreateModal && <CreateAgentModal onClose={() => setShowCreateModal(false)} onToast={showToast} />}
      {deleteAgent && <DeleteConfirmModal agent={deleteAgent} onClose={() => { setDeleteAgent(null); setSelectedAgent(null); }} onToast={showToast} />}
      {showRoundtable && (
        <RoundtableModal
          onClose={() => { setShowRoundtable(false); setActiveRoundtableAgent(null); }}
          onAgentActive={setActiveRoundtableAgent}
        />
      )}

      {/* Hierarchy - hidden on mobile when agent selected */}
      <div className={cn("flex flex-col overflow-hidden transition-all duration-300",
        selectedAgent ? "hidden md:flex md:w-3/5" : "w-full"
      )}>
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 sm:px-6 py-4 shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Agents</h1>
            <p className="text-[11px] text-zinc-500 mt-0.5">{agents.length} agents · Org Chart · Click to chat</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowRoundtable(true)} size="sm" variant="ghost"
              className="h-8 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50">
              <Users className="h-3.5 w-3.5 mr-1" /> Roundtable
            </Button>
            <Button onClick={() => setShowCreateModal(true)} size="sm"
              className="h-8 bg-indigo-600 hover:bg-indigo-500 text-[11px]">
              <Plus className="h-3.5 w-3.5 mr-1" /> New Agent
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-zinc-600" /></div>
          ) : (
            <>
            {/* Mobile Card Grid */}
            <div className="block md:hidden p-4">
              <div className="grid grid-cols-2 gap-3">
                {agents.map((a) => (
                  <MobileAgentCard key={a.id} agent={a} sessionActivity={sessionActivity} onChat={handleNodeClick} />
                ))}
              </div>
            </div>
            {/* Desktop Hierarchy */}
            <div className="hidden md:block h-full">
            <HierarchyView
              agents={agents}
              sessionCounts={{}}
              sessionActivity={sessionActivity}
              cronCounts={cronCounts}
              onNodeClick={handleNodeClick}
              onModelChange={handleModelChange}
              onMemoryClick={handleMemoryClick}
              onPingClick={handlePingClick}
              onSkillsClick={handleSkillsClick}
              onCronClick={handleCronClick}
              onDeleteClick={handleDeleteClick}
              selectedAgentId={selectedAgent?.id ?? null}
              activeRoundtableAgentId={activeRoundtableAgent}
            />
            </div>
            </>
          )}
        </div>
      </div>

      {/* Right Panel */}
      {selectedAgent && (
        <div className="w-full md:w-2/5 min-w-0 flex flex-col border-l border-zinc-800/80 bg-zinc-950">
          {/* Tab bar */}
          <div className="flex items-center border-b border-zinc-800/60 shrink-0">
            <button onClick={() => setSelectedAgent(null)} className="p-3 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn(
                  "flex items-center gap-1.5 px-3 py-3 text-[11px] font-medium transition-colors border-b-2",
                  activeTab === tab.id ? "border-indigo-500 text-indigo-400" : "border-transparent text-zinc-500 hover:text-zinc-300"
                )}>
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
            <button onClick={() => setSelectedAgent(null)} className="ml-auto p-3 text-zinc-500 hover:text-zinc-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Tab content */}
          <div className="flex-1 min-h-0">
            {activeTab === "chat" && <ChatPanel key={selectedAgent.id} agent={selectedAgent} onClose={() => setSelectedAgent(null)} />}
            {activeTab === "memory" && <MemoryPanel agent={selectedAgent} onToast={showToast} />}
            {activeTab === "skills" && <SkillsPanel agent={selectedAgent} onToast={showToast} />}
            {activeTab === "cron" && <CronPanel agent={selectedAgent} onToast={showToast} />}
          </div>
        </div>
      )}
    </div>
  );
}
