"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Loader2, X, Users, Send, ChevronDown, ChevronUp,
  RotateCcw, CheckCircle2, AlertCircle, Clock,
} from "lucide-react";

/* ─── Constants ─── */
const ROUNDTABLE_AGENTS = [
  { id: "steve",  name: "Steve",  emoji: "🧠", role: "CEO / Strategie", realId: "ceo"       },
  { id: "gary",   name: "Gary",   emoji: "📣", role: "Marketing",       realId: "marketing" },
  { id: "jimmy",  name: "Jimmy",  emoji: "✍️",  role: "Content",         realId: "content"   },
  { id: "neil",   name: "Neil",   emoji: "🔍", role: "SEO",             realId: "seo"       },
  { id: "nate",   name: "Nate",   emoji: "📊", role: "Analytics",       realId: "analytics" },
  { id: "alex",   name: "Alex",   emoji: "🤝", role: "Sales",           realId: "sales"     },
  { id: "warren", name: "Warren", emoji: "💰", role: "Finance",         realId: "finance"   },
  { id: "tom",    name: "Tom",    emoji: "🧾", role: "Tax",             realId: "tax"       },
  { id: "robert", name: "Robert", emoji: "⚖️",  role: "Legal",           realId: "legal"     },
  { id: "tiago",  name: "Tiago",  emoji: "🗓️",  role: "Notion/Systeme",  realId: "notion"    },
  { id: "pieter", name: "Pieter", emoji: "💻", role: "Tech",            realId: "tech"      },
];

const ROUND_COLORS = {
  1: { badge: "bg-blue-600/80 text-blue-100",   border: "border-blue-500/30",  label: "🔵 Runde 1" },
  2: { badge: "bg-yellow-600/80 text-yellow-100", border: "border-yellow-500/30", label: "🟡 Runde 2" },
  3: { badge: "bg-green-600/80 text-green-100",  border: "border-green-500/30",  label: "🟢 Runde 3" },
} as const;

const STORAGE_KEY = "clawdash-roundtable-v3";

/* ─── Types ─── */
interface ChatMessage {
  id: string;
  agentId: string;
  agentName: string;
  emoji: string;
  role: string;
  round: number;
  text: string;
  status: "pending" | "loading" | "done" | "error";
  ts?: number;
}

interface RoundtableState {
  topic: string;
  selectedAgentIds: string[];
  totalRounds: number;
  currentRound: number;
  messages: ChatMessage[];
  phase: "setup" | "running" | "done";
  managerSummary?: string;
  startedAt: number;
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
  const [totalRounds, setTotalRounds] = useState(2);
  const [state, setState] = useState<RoundtableState | null>(null);
  const [managerSummary, setManagerSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const abortRef = useRef(false);
  const runningRef = useRef(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const trpc = useTRPC();
  const sendMutation = useMutation(trpc.sessions.send.mutationOptions({}));

  // Load saved state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: RoundtableState = JSON.parse(saved);
        if (Date.now() - parsed.startedAt < 2 * 60 * 60 * 1000) {
          setState(parsed);
          setHasSaved(true);
          if (parsed.managerSummary) setManagerSummary(parsed.managerSummary);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Persist state
  useEffect(() => {
    if (state) {
      const toSave = { ...state, managerSummary: managerSummary ?? undefined };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    }
  }, [state, managerSummary]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.messages]);

  const send = useCallback(
    (sessionKey: string, message: string): Promise<void> =>
      new Promise((resolve, reject) => {
        sendMutation.mutate(
          { sessionKey, message, idempotencyKey: crypto.randomUUID() },
          { onSuccess: () => resolve(), onError: reject }
        );
      }),
    [sendMutation]
  );

  /* ─── Build context message for round 2+ ─── */
  const buildContextMessage = useCallback(
    (roundState: RoundtableState, agent: typeof ROUNDTABLE_AGENTS[number], round: number): string => {
      const previousMessages = roundState.messages.filter(
        (m) => m.status === "done" && m.round < round
      );
      const otherThisRound = roundState.messages.filter(
        (m) => m.status === "done" && m.round === round && m.agentId !== agent.id
      );
      const allContext = [...previousMessages, ...otherThisRound];

      const threadText = allContext
        .map((m) => `[${m.agentName} (${m.role}), Runde ${m.round}]: "${m.text}"`)
        .join("\n\n");

      return `Thema: ${roundState.topic}\n\nDie anderen Team-Mitglieder haben folgendes gesagt:\n\n${threadText}\n\nDu bist ${agent.name} (${agent.role}). Reagiere direkt auf die Aussagen der anderen. Wo stimmst du zu? Wo siehst du es anders? Was ergänzt du? Kurz und klar (3-5 Sätze). Auf Deutsch.`;
    },
    []
  );

  /* ─── Run all rounds ─── */
  const runRoundtable = useCallback(
    async (initialState: RoundtableState) => {
      if (runningRef.current) return;
      runningRef.current = true;
      abortRef.current = false;

      const agents = ROUNDTABLE_AGENTS.filter((a) =>
        initialState.selectedAgentIds.includes(a.id)
      );

      let currentState = { ...initialState };

      for (let round = 1; round <= initialState.totalRounds; round++) {
        if (abortRef.current) break;

        // Update current round
        setState((prev) => {
          if (!prev) return prev;
          currentState = { ...prev, currentRound: round };
          return currentState;
        });

        for (let i = 0; i < agents.length; i++) {
          if (abortRef.current) break;
          const agent = agents[i];
          const msgId = `${agent.id}-r${round}`;
          const sessionKey = `agent:${agent.realId}:rt:${initialState.startedAt}:r${round}`;

          // Check if already done (resume case)
          const existing = currentState.messages.find((m) => m.id === msgId);
          if (existing?.status === "done") continue;

          onAgentActive(agent.id);

          // Set loading
          setState((prev) => {
            if (!prev) return prev;
            const msgs = prev.messages.map((m) =>
              m.id === msgId ? { ...m, status: "loading" as const } : m
            );
            currentState = { ...prev, messages: msgs };
            return currentState;
          });

          try {
            let prompt: string;
            if (round === 1) {
              prompt = `Roundtable-Thema: "${initialState.topic}"\n\nDu bist ${agent.name}, ${agent.role}-Experte bei Nikramedia.\nGib deine Perspektive aus deinem Fachbereich. Sei konkret und präzise (3-5 Sätze). Kein Intro, direkt zum Punkt. Auf Deutsch.`;
            } else {
              prompt = buildContextMessage(currentState, agent, round);
            }

            await send(sessionKey, prompt);
            await new Promise((r) => setTimeout(r, 2000));
            const text = await pollForResponse(sessionKey, 90000);

            setState((prev) => {
              if (!prev) return prev;
              const msgs = prev.messages.map((m) =>
                m.id === msgId
                  ? { ...m, status: (text ? "done" : "error") as "done" | "error", text: text || "Keine Antwort erhalten.", ts: Date.now() }
                  : m
              );
              currentState = { ...prev, messages: msgs };
              return currentState;
            });
          } catch (err) {
            setState((prev) => {
              if (!prev) return prev;
              const msgs = prev.messages.map((m) =>
                m.id === msgId
                  ? { ...m, status: "error" as const, text: `Fehler: ${String(err)}` }
                  : m
              );
              currentState = { ...prev, messages: msgs };
              return currentState;
            });
          }

          onAgentActive(null);
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      setState((prev) => (prev ? { ...prev, phase: "done" } : prev));
      runningRef.current = false;
      onAgentActive(null);
    },
    [send, onAgentActive, buildContextMessage]
  );

  /* ─── Start ─── */
  const startRoundtable = useCallback(() => {
    if (!topic.trim() || selectedAgents.length === 0) return;
    localStorage.removeItem(STORAGE_KEY);

    const agents = ROUNDTABLE_AGENTS.filter((a) => selectedAgents.includes(a.id));
    const ts = Date.now();

    // Pre-create all message slots for all rounds
    const messages: ChatMessage[] = [];
    for (let round = 1; round <= totalRounds; round++) {
      for (const a of agents) {
        messages.push({
          id: `${a.id}-r${round}`,
          agentId: a.id,
          agentName: a.name,
          emoji: a.emoji,
          role: a.role,
          round,
          text: "",
          status: "pending",
        });
      }
    }

    const initialState: RoundtableState = {
      topic,
      selectedAgentIds: selectedAgents,
      totalRounds,
      currentRound: 1,
      messages,
      phase: "running",
      startedAt: ts,
    };

    setState(initialState);
    runRoundtable(initialState);
  }, [topic, selectedAgents, totalRounds, runRoundtable]);

  /* ─── Summary ─── */
  const generateSummary = useCallback(async () => {
    if (!state) return;
    setSummaryLoading(true);
    const done = state.messages.filter((e) => e.status === "done");
    const summaryPrompt = `Fasse die folgenden Team-Diskussion zum Thema "${state.topic}" zusammen (${state.totalRounds} Runden). Identifiziere:\n1. Die 3 wichtigsten Erkenntnisse\n2. Wo das Team sich einig war\n3. Wo es unterschiedliche Meinungen gab\n4. Konkrete nächste Schritte\n\n${done
      .map((e) => `**${e.agentName} (${e.role}) [Runde ${e.round}]:** ${e.text}`)
      .join("\n\n")}`;

    const ts = Date.now();
    const sessionKey = `agent:main:rt-summary:${ts}`;
    try {
      await send(sessionKey, summaryPrompt);
      await new Promise((r) => setTimeout(r, 2000));
      const text = await pollForResponse(sessionKey, 60000);
      setManagerSummary(text || "Zusammenfassung nicht verfügbar.");
      setState((prev) => (prev ? { ...prev, managerSummary: text } : prev));
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
    setHasSaved(false);
    onAgentActive(null);
  };

  /* ─── Progress ─── */
  const doneCount = state?.messages.filter((e) => e.status === "done").length ?? 0;
  const totalCount = state?.messages.length ?? 0;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const currentAgent = state?.messages.find((e) => e.status === "loading");

  /* ─── Group messages by round ─── */
  const messagesByRound = state?.messages.reduce<Record<number, ChatMessage[]>>((acc, m) => {
    (acc[m.round] ??= []).push(m);
    return acc;
  }, {}) ?? {};

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
                <h2 className="text-base font-semibold text-zinc-100">War Room</h2>
                <p className="text-[11px] text-zinc-500">Multi-Runden Team-Diskussion</p>
              </div>
            </div>
            <Button onClick={onClose} variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-6 space-y-5">
            {/* Saved state banner */}
            {hasSaved && (
              <div className="flex items-center justify-between bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-amber-300">
                  <Clock className="h-4 w-4" />
                  Laufende Diskussion gefunden
                </div>
                <Button
                  onClick={() => setState(JSON.parse(localStorage.getItem(STORAGE_KEY)!))}
                  size="sm"
                  className="h-7 text-[11px] bg-amber-700/60 hover:bg-amber-600 text-amber-100"
                >
                  Fortsetzen
                </Button>
              </div>
            )}

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
                  if (e.key === "Enter" && e.metaKey) startRoundtable();
                }}
              />
              <p className="text-[10px] text-zinc-600 mt-1">⌘+Enter zum Starten</p>
            </div>

            {/* Round Selector */}
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-2 block">
                Anzahl Runden
              </label>
              <div className="flex gap-2">
                {[1, 2, 3].map((r) => (
                  <button
                    key={r}
                    onClick={() => setTotalRounds(r)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all",
                      totalRounds === r
                        ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                        : "bg-zinc-900 border-zinc-700/50 text-zinc-500 hover:border-zinc-600"
                    )}
                  >
                    {r === 1 && "1 Runde — Schnell"}
                    {r === 2 && "2 Runden — Diskussion"}
                    {r === 3 && "3 Runden — Konsens"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">
                {totalRounds === 1 && "Jeder Agent gibt seine Perspektive — wie bisher."}
                {totalRounds === 2 && "Runde 2: Agents reagieren aufeinander und vertiefen."}
                {totalRounds === 3 && "Runde 3: Team arbeitet Richtung Konsens und Aktionsplan."}
              </p>
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
              onClick={startRoundtable}
              disabled={!topic.trim() || selectedAgents.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-500 h-10"
            >
              <Send className="h-4 w-4 mr-2" />
              War Room starten ({selectedAgents.length} Agents · {totalRounds} {totalRounds === 1 ? "Runde" : "Runden"})
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-xl bg-indigo-600/20 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-zinc-100 truncate">{state.topic}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                {state.phase === "running" && currentAgent ? (
                  <p className="text-[11px] text-indigo-400 flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                    {currentAgent.emoji} {currentAgent.agentName} denkt... (Runde {currentAgent.round})
                  </p>
                ) : state.phase === "done" ? (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Abgeschlossen · {doneCount}/{totalCount} Nachrichten · {state.totalRounds} {state.totalRounds === 1 ? "Runde" : "Runden"}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={clearAndReset} variant="ghost" size="sm"
              className="h-7 text-[10px] text-zinc-500 hover:text-zinc-300 gap-1">
              <RotateCcw className="h-3 w-3" /> Neu
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-zinc-800 shrink-0">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Chat Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-1">
            {Object.entries(messagesByRound)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([roundStr, msgs]) => {
                const round = Number(roundStr) as 1 | 2 | 3;
                const rc = ROUND_COLORS[round] ?? ROUND_COLORS[1];
                return (
                  <div key={round}>
                    {/* Round Divider */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-zinc-800" />
                      <span className={cn("text-[11px] font-medium px-3 py-1 rounded-full", rc.badge)}>
                        {rc.label}
                      </span>
                      <div className="flex-1 h-px bg-zinc-800" />
                    </div>

                    {/* Messages */}
                    <div className="space-y-2">
                      {msgs.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} />
                      ))}
                    </div>
                  </div>
                );
              })}

            {/* Manager Summary */}
            {state.phase === "done" && (
              <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-950/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📋</span>
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
        <div className="px-6 py-3 border-t border-zinc-800/60 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500">
            {state.phase === "running" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                Runde {state.currentRound}/{state.totalRounds} · Schließen ist sicher
              </span>
            )}
            {state.phase === "done" && (
              <span className="text-emerald-500/70">✓ Diskussion abgeschlossen</span>
            )}
          </div>
          <div className="flex gap-2">
            {state.phase === "running" && (
              <Button
                onClick={() => { abortRef.current = true; setState((p) => p ? { ...p, phase: "done" } : p); onAgentActive(null); }}
                variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-300"
              >
                Abbrechen
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

/* ─── Chat Bubble ─── */
function ChatBubble({ message }: { message: ChatMessage }) {
  const rc = ROUND_COLORS[message.round as 1 | 2 | 3] ?? ROUND_COLORS[1];

  return (
    <div
      className={cn(
        "flex gap-3 py-3 px-4 rounded-xl transition-all duration-300",
        message.status === "loading" && "bg-indigo-950/15",
        message.status === "done" && "hover:bg-zinc-900/40",
        message.status === "error" && "bg-red-950/10",
        message.status === "pending" && "opacity-30"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-base border",
        message.status === "loading" ? "border-indigo-500/60 bg-indigo-950/40 animate-pulse" :
        message.status === "done" ? "border-zinc-700/40 bg-zinc-800/40" :
        message.status === "error" ? "border-red-700/40 bg-red-950/30" :
        "border-zinc-800/30 bg-zinc-900/30"
      )}>
        {message.emoji}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-zinc-200">{message.agentName}</span>
          <span className="text-[11px] text-zinc-500">{message.role}</span>
          <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded", rc.badge)}>
            R{message.round}
          </span>
          {message.status === "loading" && (
            <Loader2 className="h-3 w-3 animate-spin text-indigo-400 ml-auto" />
          )}
          {message.status === "done" && (
            <CheckCircle2 className="h-3 w-3 text-emerald-500/50 ml-auto" />
          )}
          {message.status === "error" && (
            <AlertCircle className="h-3 w-3 text-red-400 ml-auto" />
          )}
        </div>

        {message.status === "pending" && (
          <p className="text-xs text-zinc-600 italic">Wartet...</p>
        )}
        {message.status === "loading" && (
          <div className="flex gap-1 mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:240ms]" />
          </div>
        )}
        {(message.status === "done" || message.status === "error") && message.text && (
          <p className={cn(
            "text-[13px] leading-relaxed",
            message.status === "error" ? "text-red-400" : "text-zinc-300"
          )}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
