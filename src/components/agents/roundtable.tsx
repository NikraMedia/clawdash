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
  { id: "steve",  name: "Steve",  emoji: "🧠", role: "CEO",       realId: "ceo"       },
  { id: "gary",   name: "Gary",   emoji: "📣", role: "Marketing", realId: "marketing" },
  { id: "jimmy",  name: "Jimmy",  emoji: "✍️", role: "Content",   realId: "content"   },
  { id: "neil",   name: "Neil",   emoji: "🔍", role: "SEO",       realId: "seo"       },
  { id: "nate",   name: "Nate",   emoji: "📊", role: "Analytics", realId: "analytics" },
  { id: "alex",   name: "Alex",   emoji: "🤝", role: "Sales",     realId: "sales"     },
  { id: "warren", name: "Warren", emoji: "💰", role: "Finance",   realId: "finance"   },
  { id: "tom",    name: "Tom",    emoji: "🧾", role: "Tax",       realId: "tax"       },
  { id: "robert", name: "Robert", emoji: "⚖️", role: "Legal",     realId: "legal"     },
  { id: "tiago",  name: "Tiago",  emoji: "🗓️", role: "Notion",    realId: "notion"    },
  { id: "pieter", name: "Pieter", emoji: "💻", role: "Tech",      realId: "tech"      },
];

const STORAGE_KEY = "clawdash-roundtable-state";

/* ─── Types ─── */
export interface RoundtableEntry {
  agentId: string;
  name: string;
  emoji: string;
  role: string;
  content: string;
  status: "pending" | "loading" | "done" | "error";
  sessionKey?: string;
  ts?: number;
}

interface RoundtableState {
  topic: string;
  entries: RoundtableEntry[];
  phase: "setup" | "running" | "done";
  managerSummary?: string;
  startedAt: number;
  currentIndex: number;
}

/* ─── Helpers ─── */
async function pollForResponse(sessionKey: string, maxWaitMs = 90000): Promise<string> {
  const start = Date.now();
  const interval = 3000;

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, interval));
    try {
      const url = `/api/trpc/sessions.history?input=${encodeURIComponent(
        JSON.stringify({ json: { sessionKey, limit: 20 } })
      )}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      // tRPC v11 response unwrap
      const raw =
        data?.result?.data?.json ??
        data?.result?.data ??
        data?.result ??
        data;

      const messages: Array<{ role: string; content?: unknown; text?: string }> =
        Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.messages)
          ? raw.messages
          : Array.isArray(raw?.json)
          ? raw.json
          : [];

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
  const [state, setState] = useState<RoundtableState | null>(null);
  const [managerSummary, setManagerSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const abortRef = useRef(false);
  const runningRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trpc = useTRPC();
  const sendMutation = useMutation(trpc.sessions.send.mutationOptions({}));

  // Load saved state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: RoundtableState = JSON.parse(saved);
        // Only restore if less than 2 hours old
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

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state?.entries]);

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

  const runRoundtable = useCallback(
    async (initialState: RoundtableState, startFrom = 0) => {
      if (runningRef.current) return;
      runningRef.current = true;
      abortRef.current = false;

      const ordered = ROUNDTABLE_AGENTS.filter((a) =>
        initialState.entries.some((e) => e.agentId === a.id)
      );

      for (let i = startFrom; i < ordered.length; i++) {
        if (abortRef.current) break;
        const agent = ordered[i];
        const sessionKey = `agent:${agent.realId}:rt:${initialState.startedAt}`;

        onAgentActive(agent.id);

        // Set loading
        setState((prev) => {
          if (!prev) return prev;
          const entries = prev.entries.map((e) =>
            e.agentId === agent.id ? { ...e, status: "loading" as const, sessionKey } : e
          );
          return { ...prev, entries, currentIndex: i };
        });

        try {
          const prompt = `Roundtable-Thema: "${initialState.topic}"\n\nDu bist ${agent.name}, ${agent.role}-Experte bei Nikramedia.\nGib deine Perspektive aus deinem Fachbereich. Sei konkret und präzise (3-5 Sätze). Kein Intro, direkt zum Punkt. Auf Deutsch.`;

          await send(sessionKey, prompt);

          // Wait 2s for session to be created, then poll
          await new Promise((r) => setTimeout(r, 2000));
          const text = await pollForResponse(sessionKey, 90000);

          setState((prev) => {
            if (!prev) return prev;
            const entries = prev.entries.map((e) =>
              e.agentId === agent.id
                ? {
                    ...e,
                    status: text ? ("done" as const) : ("error" as const),
                    content: text || "Keine Antwort erhalten.",
                    ts: Date.now(),
                  }
                : e
            );
            return { ...prev, entries };
          });
        } catch (err) {
          setState((prev) => {
            if (!prev) return prev;
            const entries = prev.entries.map((e) =>
              e.agentId === agent.id
                ? { ...e, status: "error" as const, content: `Fehler: ${String(err)}` }
                : e
            );
            return { ...prev, entries };
          });
        }

        onAgentActive(null);
        await new Promise((r) => setTimeout(r, 800));
      }

      setState((prev) => (prev ? { ...prev, phase: "done" } : prev));
      runningRef.current = false;
      onAgentActive(null);
    },
    [send, onAgentActive]
  );

  const startRoundtable = useCallback(() => {
    if (!topic.trim() || selectedAgents.length === 0) return;
    localStorage.removeItem(STORAGE_KEY);

    const ordered = ROUNDTABLE_AGENTS.filter((a) => selectedAgents.includes(a.id));
    const ts = Date.now();

    const initialState: RoundtableState = {
      topic,
      phase: "running",
      startedAt: ts,
      currentIndex: 0,
      entries: ordered.map((a) => ({
        agentId: a.id,
        name: a.name,
        emoji: a.emoji,
        role: a.role,
        content: "",
        status: "pending",
      })),
    };

    setState(initialState);
    runRoundtable(initialState, 0);
  }, [topic, selectedAgents, runRoundtable]);

  const resumeRoundtable = useCallback(() => {
    if (!state) return;
    const startFrom = state.entries.findIndex(
      (e) => e.status === "pending" || e.status === "loading"
    );
    if (startFrom === -1) return;
    // Reset loading ones back to pending
    setState((prev) => {
      if (!prev) return prev;
      const entries = prev.entries.map((e) =>
        e.status === "loading" ? { ...e, status: "pending" as const } : e
      );
      return { ...prev, phase: "running", entries };
    });
    setTimeout(() => runRoundtable({ ...state, phase: "running" }, startFrom), 100);
  }, [state, runRoundtable]);

  const generateSummary = useCallback(async () => {
    if (!state) return;
    setSummaryLoading(true);
    const done = state.entries.filter((e) => e.status === "done");
    const summaryPrompt = `Fasse die folgenden Team-Inputs zum Thema "${state.topic}" zusammen. Identifiziere die 3 wichtigsten Punkte und nenne direkte nächste Schritte:\n\n${done
      .map((e) => `**${e.name} (${e.role}):** ${e.content}`)
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
  const doneCount = state?.entries.filter((e) => e.status === "done").length ?? 0;
  const totalCount = state?.entries.length ?? 0;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const currentAgent = state?.entries.find((e) => e.status === "loading");

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
                <h2 className="text-base font-semibold text-zinc-100">Roundtable</h2>
                <p className="text-[11px] text-zinc-500">Alle Agents antworten auf ein Thema</p>
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
                  Gespeicherter Roundtable gefunden
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
              Roundtable starten ({selectedAgents.length} Agents)
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
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {currentAgent.emoji} {currentAgent.name} denkt...
                  </p>
                ) : state.phase === "done" ? (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Abgeschlossen · {doneCount}/{totalCount} Antworten
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

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          <div ref={scrollRef} className="p-6 space-y-3">
            {/* Entries */}
            {state.entries.map((entry, idx) => (
              <RoundtableCard key={entry.agentId} entry={entry} index={idx} />
            ))}

            {/* Manager Summary */}
            {state.phase === "done" && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-950/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📋</span>
                  <span className="text-sm font-semibold text-amber-300">Manager Zusammenfassung</span>
                  <span className="text-[10px] text-zinc-600 ml-1">— Manager fasst alle Inputs zusammen</span>
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
                    Manager analysiert alle Antworten...
                  </div>
                )}
                {managerSummary && (
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{managerSummary}</p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/60 flex items-center justify-between shrink-0">
          <div className="text-xs text-zinc-500">
            {state.phase === "running" && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                Läuft... · Schließen ist sicher, Fortschritt wird gespeichert
              </span>
            )}
            {state.phase === "done" && (
              <span className="text-emerald-500/70">✓ Gespeichert · Beim nächsten Öffnen wieder abrufbar</span>
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
            {state.phase === "done" &&
              state.entries.some((e) => e.status === "error" || e.status === "pending") && (
                <Button onClick={resumeRoundtable} variant="ghost" size="sm"
                  className="h-7 text-xs text-indigo-400 hover:text-indigo-300 gap-1">
                  <RotateCcw className="h-3 w-3" /> Fehlgeschlagene wiederholen
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

/* ─── Single Entry Card ─── */
function RoundtableCard({ entry, index }: { entry: RoundtableEntry; index: number }) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-4 transition-all duration-500",
        entry.status === "loading"
          ? "border-indigo-500/60 bg-indigo-950/20"
          : entry.status === "done"
          ? "border-zinc-700/40 bg-zinc-900/30"
          : entry.status === "error"
          ? "border-red-700/30 bg-red-950/10"
          : "border-zinc-800/30 bg-zinc-950/30 opacity-40"
      )}
    >
      {/* Avatar */}
      <div className="shrink-0 flex flex-col items-center gap-1">
        <div className={cn(
          "h-9 w-9 rounded-xl flex items-center justify-center text-lg border",
          entry.status === "loading" ? "border-indigo-500/60 bg-indigo-950/40" :
          entry.status === "done" ? "border-zinc-700/60 bg-zinc-800/60" :
          entry.status === "error" ? "border-red-700/40 bg-red-950/30" :
          "border-zinc-800/40 bg-zinc-900/40"
        )}>
          {entry.emoji}
        </div>
        <span className="text-[9px] text-zinc-600 font-mono">#{index + 1}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-zinc-200">{entry.name}</span>
          <span className="text-xs text-zinc-500">{entry.role}</span>
          <div className="ml-auto">
            {entry.status === "loading" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
            )}
            {entry.status === "done" && (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            )}
            {entry.status === "error" && (
              <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            )}
          </div>
        </div>

        {entry.status === "pending" && (
          <p className="text-xs text-zinc-600 italic">Wartet...</p>
        )}
        {entry.status === "loading" && (
          <div className="flex gap-1 mt-1">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:120ms]" />
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:240ms]" />
          </div>
        )}
        {(entry.status === "done" || entry.status === "error") && entry.content && (
          <p className={cn(
            "text-sm leading-relaxed",
            entry.status === "error" ? "text-red-400" : "text-zinc-300"
          )}>
            {entry.content}
          </p>
        )}
      </div>
    </div>
  );
}
