"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, generateId } from "@/lib/utils";
import {
  Loader2, X, Users, Send, ChevronDown, ChevronUp,
  RotateCcw, CheckCircle2, AlertCircle,
} from "lucide-react";

/* ─── Constants ─── */
const ROUNDTABLE_AGENTS = [
  { id: "steve",  name: "Steve",  emoji: "\u{1F9E0}", role: "CEO / Strategie", realId: "ceo"       },
  { id: "gary",   name: "Gary",   emoji: "\u{1F4E3}", role: "Marketing",       realId: "marketing" },
  { id: "jimmy",  name: "Jimmy",  emoji: "\u270D\uFE0F",  role: "Content",         realId: "content"   },
  { id: "neil",   name: "Neil",   emoji: "\u{1F50D}", role: "SEO",             realId: "seo"       },
  { id: "nate",   name: "Nate",   emoji: "\u{1F4CA}", role: "Analytics",       realId: "analytics" },
  { id: "alex",   name: "Alex",   emoji: "\u{1F91D}", role: "Sales",           realId: "sales"     },
  { id: "warren", name: "Warren", emoji: "\u{1F4B0}", role: "Finance",         realId: "finance"   },
  { id: "tom",    name: "Tom",    emoji: "\u{1F9FE}", role: "Tax",             realId: "tax"       },
  { id: "robert", name: "Robert", emoji: "\u2696\uFE0F",  role: "Legal",           realId: "legal"     },
  { id: "tiago",  name: "Tiago",  emoji: "\u{1F5D3}\uFE0F",  role: "Notion/Systeme",  realId: "notion"    },
  { id: "pieter", name: "Pieter", emoji: "\u{1F4BB}", role: "Tech",            realId: "tech"      },
];

const MAX_MESSAGES = 20;
const STORAGE_KEY = "clawdash-warroom-v1";

/* ─── Types ─── */
interface WarRoomMessage {
  id: string;
  agentId: string;
  agentName: string;
  emoji: string;
  role: string;
  content: string;
  timestamp: number;
  replyTo?: string;
}

interface WarRoomState {
  topic: string;
  selectedAgentIds: string[];
  messages: WarRoomMessage[];
  status: "idle" | "running" | "finished";
  currentSpeaker: string | null;
  startedAt: number;
  managerSummary?: string;
}

/* ─── Helpers ─── */
async function pollForResponse(sessionKey: string, maxWaitMs = 90000): Promise<string> {
  const start = Date.now();
  const interval = 3000;

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, interval));
    try {
      const url = `/api/trpc/sessions.history?input=${encodeURIComponent(
        JSON.stringify({ sessionKey, limit: 20 })
      )}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      const raw = data?.result?.data ?? data?.result ?? data;
      const messages: Array<{ role: string; content?: unknown; text?: string }> =
        Array.isArray(raw?.messages) ? raw.messages : Array.isArray(raw) ? raw : [];

      const assistantMsgs = messages.filter((m) => m.role === "assistant");
      if (assistantMsgs.length > 0) {
        const last = assistantMsgs[assistantMsgs.length - 1];
        const text =
          typeof last.content === "string"
            ? last.content
            : Array.isArray(last.content)
            ? last.content
                .filter((b: { type: string }) => b.type === "text")
                .map((b: { text?: string }) => b.text ?? "")
                .join("")
            : last.text ?? "";
        if (text.trim()) return text.trim();
      }
    } catch {
      // network hiccup — keep polling
    }
  }
  return "";
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/* ─── Props ─── */
interface RoundtableModalProps {
  onClose: () => void;
  onAgentActive: (agentId: string | null) => void;
}

/* ─── Main Component ─── */
export function RoundtableModal({ onClose, onAgentActive }: RoundtableModalProps) {
  const [topic, setTopic] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>(
    ROUNDTABLE_AGENTS.map((a) => a.id)
  );
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [state, setState] = useState<WarRoomState | null>(null);
  const [managerSummary, setManagerSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const abortRef = useRef(false);
  const runningRef = useRef(false);
  const messagesRef = useRef<WarRoomMessage[]>([]);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const trpc = useTRPC();
  const sendMutation = useMutation(trpc.sessions.send.mutationOptions({}));

  // Auto-scroll to bottom
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.messages]);

  // Keep messagesRef in sync
  useEffect(() => {
    if (state?.messages) messagesRef.current = state.messages;
  }, [state?.messages]);

  const send = useCallback(
    (sessionKey: string, message: string): Promise<void> =>
      new Promise((resolve, reject) => {
        sendMutation.mutate(
          { sessionKey, message, idempotencyKey: generateId() },
          { onSuccess: () => resolve(), onError: reject }
        );
      }),
    [sendMutation]
  );

  const getAgent = (id: string) => ROUNDTABLE_AGENTS.find((a) => a.id === id || a.realId === id);

  const addMessage = useCallback((agentId: string, content: string) => {
    const agent = getAgent(agentId);
    if (!agent) return;
    const msg: WarRoomMessage = {
      id: generateId(),
      agentId: agent.id,
      agentName: agent.name,
      emoji: agent.emoji,
      role: agent.role,
      content,
      timestamp: Date.now(),
    };
    setState((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, messages: [...prev.messages, msg] };
      messagesRef.current = updated.messages;
      return updated;
    });
  }, []);

  /* ─── War Room Logic ─── */
  const runWarRoom = useCallback(
    async (initialState: WarRoomState) => {
      if (runningRef.current) return;
      runningRef.current = true;
      abortRef.current = false;

      const agents = ROUNDTABLE_AGENTS.filter((a) =>
        initialState.selectedAgentIds.includes(a.id)
      );

      if (agents.length === 0) {
        runningRef.current = false;
        return;
      }

      const ts = initialState.startedAt;

      // First agent starts
      const firstAgent = agents[0];
      setState((prev) => prev ? { ...prev, currentSpeaker: firstAgent.id } : prev);
      onAgentActive(firstAgent.id);

      const firstSessionKey = `agent:${firstAgent.realId}:warroom:${ts}`;
      const firstPrompt = `Du bist in einem War Room mit deinen Kollegen. Das Thema: "${initialState.topic}". Starte die Diskussion mit deiner Einschätzung. Sei konkret und direkt (max 3 Sätze). Auf Deutsch.`;

      try {
        await send(firstSessionKey, firstPrompt);
        await new Promise((r) => setTimeout(r, 2000));
        const firstResponse = await pollForResponse(firstSessionKey, 90000);
        if (firstResponse) {
          addMessage(firstAgent.id, firstResponse);
        }
      } catch {
        addMessage(firstAgent.id, "Fehler beim Starten der Diskussion.");
      }

      onAgentActive(null);
      setState((prev) => prev ? { ...prev, currentSpeaker: null } : prev);

      // Iteration loop
      let round = 0;
      const otherAgents = agents.slice(1);

      while (round < 15) {
        if (abortRef.current) break;
        if (messagesRef.current.length >= MAX_MESSAGES) break;

        let allPassed = true;

        for (const agent of otherAgents) {
          if (abortRef.current) break;
          if (messagesRef.current.length >= MAX_MESSAGES) break;

          setState((prev) => prev ? { ...prev, currentSpeaker: agent.id } : prev);
          onAgentActive(agent.id);

          const context = messagesRef.current
            .map((m) => `${m.agentName} (${m.role}): "${m.content}"`)
            .join("\n");

          const sessionKey = `agent:${agent.realId}:warroom:${ts}:r${round}:${agent.id}`;
          const prompt = `War Room Diskussion zu: "${initialState.topic}"\n\nBisherige Nachrichten:\n${context}\n\nDu bist ${agent.name} (${agent.role}). Möchtest du etwas beitragen? Antworte ENTWEDER mit "Pass" (wenn du nichts Relevantes hinzuzufügen hast) ODER direkt mit deinem Beitrag (max 2-3 Sätze, kein "Ja:" Präfix). Auf Deutsch.`;

          try {
            await send(sessionKey, prompt);
            await new Promise((r) => setTimeout(r, 2000));
            const response = await pollForResponse(sessionKey, 90000);

            const trimmed = response.trim().toLowerCase();
            if (!response || trimmed === "pass" || trimmed.startsWith("pass.") || trimmed.startsWith("pass,") || trimmed.startsWith("pass -") || trimmed === "pass.") {
              // Agent passes
            } else {
              addMessage(agent.id, response);
              allPassed = false;
              onAgentActive(null);
              setState((prev) => prev ? { ...prev, currentSpeaker: null } : prev);
              await new Promise((r) => setTimeout(r, 500));
              break; // restart loop after every contribution
            }
          } catch {
            // skip on error
          }

          onAgentActive(null);
          setState((prev) => prev ? { ...prev, currentSpeaker: null } : prev);
          await new Promise((r) => setTimeout(r, 500));
        }

        if (allPassed) break; // all agents passed → natural end
        round++;
      }

      setState((prev) => prev ? { ...prev, status: "finished", currentSpeaker: null } : prev);
      runningRef.current = false;
      onAgentActive(null);
    },
    [send, onAgentActive, addMessage]
  );

  /* ─── Start ─── */
  const startWarRoom = useCallback(() => {
    if (!topic.trim() || selectedAgents.length === 0) return;
    localStorage.removeItem(STORAGE_KEY);

    const initialState: WarRoomState = {
      topic: topic.trim(),
      selectedAgentIds: selectedAgents,
      messages: [],
      status: "running",
      currentSpeaker: null,
      startedAt: Date.now(),
    };

    setState(initialState);
    messagesRef.current = [];
    runWarRoom(initialState);
  }, [topic, selectedAgents, runWarRoom]);

  /* ─── Summary ─── */
  const generateSummary = useCallback(async () => {
    if (!state) return;
    setSummaryLoading(true);
    const summaryPrompt = `Fasse die folgende War Room Diskussion zum Thema "${state.topic}" zusammen. Identifiziere:\n1. Die 3 wichtigsten Erkenntnisse\n2. Wo das Team sich einig war\n3. Wo es unterschiedliche Meinungen gab\n4. Konkrete nächste Schritte\n\n${state.messages
      .map((m) => `**${m.agentName} (${m.role}):** ${m.content}`)
      .join("\n\n")}`;

    const sessionKey = `agent:main:warroom-summary:${Date.now()}`;
    try {
      await send(sessionKey, summaryPrompt);
      await new Promise((r) => setTimeout(r, 2000));
      const text = await pollForResponse(sessionKey, 60000);
      setManagerSummary(text || "Zusammenfassung nicht verfügbar.");
    } catch {
      setManagerSummary("Fehler beim Generieren.");
    }
    setSummaryLoading(false);
  }, [state, send]);

  const clearAndReset = () => {
    abortRef.current = true;
    runningRef.current = false;
    localStorage.removeItem(STORAGE_KEY);
    setState(null);
    setManagerSummary(null);
    setTopic("");
    onAgentActive(null);
  };

  const stopDiscussion = () => {
    abortRef.current = true;
    setState((prev) => prev ? { ...prev, status: "finished", currentSpeaker: null } : prev);
    onAgentActive(null);
  };

  const currentAgent = state?.currentSpeaker ? getAgent(state.currentSpeaker) : null;

  /* ─── Render: Setup ─── */
  if (!state) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-zinc-950 border border-zinc-800 rounded-2xl w-[640px] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                <Users className="h-4.5 w-4.5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-100">{"\u{1F525}"} War Room</h2>
                <p className="text-[11px] text-zinc-500">Organische Team-Diskussion</p>
              </div>
            </div>
            <Button onClick={onClose} variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-6 space-y-5">
            {/* Topic */}
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-2 block">
                Thema / Frage an das Team
              </label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="z.B. Wie können wir unsere Preise erhöhen ohne Kunden zu verlieren?"
                className="bg-zinc-900 border-zinc-700 text-zinc-100 resize-none h-24 text-sm placeholder:text-zinc-600"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) startWarRoom();
                }}
              />
              <p className="text-[10px] text-zinc-600 mt-1">{"\u2318"}+Enter zum Starten</p>
            </div>

            {/* Agent Picker */}
            <div>
              <button
                onClick={() => setShowAgentPicker((p) => !p)}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors w-full"
              >
                {showAgentPicker ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <span>Teilnehmer auswählen</span>
                <span className="ml-auto bg-zinc-800 text-zinc-400 rounded-full px-2 py-0.5 text-[10px]">
                  {selectedAgents.length}/{ROUNDTABLE_AGENTS.length}
                </span>
              </button>
              {showAgentPicker && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  <button
                    onClick={() =>
                      setSelectedAgents(
                        selectedAgents.length === ROUNDTABLE_AGENTS.length
                          ? []
                          : ROUNDTABLE_AGENTS.map((a) => a.id)
                      )
                    }
                    className="col-span-4 text-[10px] text-zinc-500 hover:text-zinc-300 text-left py-1"
                  >
                    {selectedAgents.length === ROUNDTABLE_AGENTS.length ? "Alle abwählen" : "Alle auswählen"}
                  </button>
                  {ROUNDTABLE_AGENTS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() =>
                        setSelectedAgents((prev) =>
                          prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                        )
                      }
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-all",
                        selectedAgents.includes(a.id)
                          ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                          : "bg-zinc-900 border-zinc-700/50 text-zinc-500 hover:border-zinc-600"
                      )}
                    >
                      <span>{a.emoji}</span>
                      <span className="font-medium">{a.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={startWarRoom}
              disabled={!topic.trim() || selectedAgents.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-500 h-10"
            >
              <Send className="h-4 w-4 mr-2" />
              War Room starten ({selectedAgents.length} Agents)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Render: Running / Done ─── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-2xl w-[820px] h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{"\u{1F525}"} War Room</h2>
            <p className="text-[11px] text-zinc-500 truncate max-w-[300px]">{state.topic}</p>
          </div>
          <div className="flex items-center gap-2">
            {state.status === "running" && (
              <span className="text-[11px] text-indigo-400 flex items-center gap-1">
                <span className="animate-pulse">{"\u25CF"}</span> Live
              </span>
            )}
            {state.status === "finished" && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Beendet
              </span>
            )}
            <Button onClick={clearAndReset} variant="ghost" size="sm"
              className="h-7 text-[10px] text-zinc-500 hover:text-zinc-300 gap-1">
              <RotateCcw className="h-3 w-3" /> Neu
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-1">
            {state.messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0">
                  {msg.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold text-zinc-100">{msg.agentName}</span>
                    <span className="text-[10px] text-zinc-500">{msg.role}</span>
                    <span className="text-[10px] text-zinc-600 ml-auto">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="bg-zinc-800/60 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-zinc-200 leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

            {/* Current speaker indicator */}
            {state.status === "running" && currentAgent && (
              <div className="flex items-start gap-3 mb-4 opacity-60">
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-lg shrink-0 animate-pulse">
                  {currentAgent.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold text-zinc-100">{currentAgent.name}</span>
                    <span className="text-[10px] text-zinc-500">{currentAgent.role}</span>
                  </div>
                  <div className="bg-zinc-800/40 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-zinc-400">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:240ms]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manager Summary */}
            {state.status === "finished" && (
              <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-950/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{"\u{1F4CB}"}</span>
                  <span className="text-sm font-semibold text-amber-300">Manager Zusammenfassung</span>
                </div>
                {!managerSummary && !summaryLoading && (
                  <Button
                    onClick={generateSummary}
                    size="sm"
                    className="bg-amber-700/60 hover:bg-amber-600 text-amber-100 h-8 text-xs"
                  >
                    Zusammenfassung generieren
                  </Button>
                )}
                {summaryLoading && (
                  <div className="flex items-center gap-2 text-xs text-amber-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Manager analysiert die Diskussion...
                  </div>
                )}
                {managerSummary && (
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{managerSummary}</p>
                )}
              </div>
            )}

            <div ref={scrollEndRef} />
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800/60 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500">
            {state.status === "running" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                {state.messages.length}/{MAX_MESSAGES} Nachrichten
              </span>
            )}
            {state.status === "finished" && (
              <span className="text-emerald-500/70">{"\u2713"} {state.messages.length} Nachrichten</span>
            )}
          </div>
          <div className="flex gap-2">
            {state.status === "running" && (
              <Button
                onClick={stopDiscussion}
                variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300"
              >
                Diskussion beenden
              </Button>
            )}
            <Button onClick={onClose} variant="ghost" size="sm" className="h-7 text-xs text-zinc-400">
              Schließen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
