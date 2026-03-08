"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Loader2, X, Users, Send, ChevronDown, ChevronUp } from "lucide-react";

const ROUNDTABLE_AGENTS = [
  { id: "steve", name: "Steve", emoji: "🧠", role: "CEO" },
  { id: "gary", name: "Gary", emoji: "📣", role: "Marketing" },
  { id: "jimmy", name: "Jimmy", emoji: "✍️", role: "Content" },
  { id: "neil", name: "Neil", emoji: "🔍", role: "SEO" },
  { id: "nate", name: "Nate", emoji: "📊", role: "Analytics" },
  { id: "alex", name: "Alex", emoji: "🤝", role: "Sales" },
  { id: "warren", name: "Warren", emoji: "💰", role: "Finance" },
  { id: "tom", name: "Tom", emoji: "🧾", role: "Tax" },
  { id: "robert", name: "Robert", emoji: "⚖️", role: "Legal" },
  { id: "tiago", name: "Tiago", emoji: "🗓️", role: "Notion" },
  { id: "pieter", name: "Pieter", emoji: "💻", role: "Tech" },
];

const AGENT_ID_MAP: Record<string, string> = {
  steve: "ceo", gary: "marketing", jimmy: "content", neil: "seo",
  nate: "analytics", alex: "sales", warren: "finance", tom: "tax",
  robert: "legal", tiago: "notion", pieter: "tech", manager: "main",
};

interface RoundtableResponse {
  agentId: string;
  name: string;
  emoji: string;
  role: string;
  content: string;
  status: "pending" | "loading" | "done" | "error";
}

interface RoundtableModalProps {
  onClose: () => void;
  onAgentActive: (agentId: string | null) => void;
}

export function RoundtableModal({ onClose, onAgentActive }: RoundtableModalProps) {
  const [topic, setTopic] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>(
    ROUNDTABLE_AGENTS.map((a) => a.id)
  );
  const [responses, setResponses] = useState<RoundtableResponse[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<"setup" | "running" | "done">("setup");
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [managerSummary, setManagerSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const abortRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const trpc = useTRPC();

  const sendMutation = useMutation(trpc.sessions.send.mutationOptions({}));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [responses]);

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const startRoundtable = useCallback(async () => {
    if (!topic.trim() || selectedAgents.length === 0) return;
    abortRef.current = false;
    setIsRunning(true);
    setPhase("running");
    setManagerSummary(null);

    const ordered = ROUNDTABLE_AGENTS.filter((a) => selectedAgents.includes(a.id));

    // Init responses
    setResponses(
      ordered.map((a) => ({
        agentId: a.id,
        name: a.name,
        emoji: a.emoji,
        role: a.role,
        content: "",
        status: "pending",
      }))
    );

    for (let i = 0; i < ordered.length; i++) {
      if (abortRef.current) break;
      const agent = ordered[i];
      const realId = AGENT_ID_MAP[agent.id] ?? agent.id;
      const sessionKey = `roundtable:${realId}:${Date.now()}`;

      onAgentActive(agent.id);

      // Set loading
      setResponses((prev) =>
        prev.map((r) =>
          r.agentId === agent.id ? { ...r, status: "loading" } : r
        )
      );

      try {
        const prompt = `Roundtable-Thema: "${topic}"\n\nGib deine Perspektive als ${agent.role}-Experte. Kurz und präzise (3-5 Sätze). Kein Intro, direkt zum Punkt.`;

        await new Promise<void>((resolve, reject) => {
          sendMutation.mutate(
            {
              sessionKey,
              message: prompt,
              idempotencyKey: crypto.randomUUID(),
            },
            {
              onSuccess: () => resolve(),
              onError: (err) => reject(err),
            }
          );
        });

        // Poll for response
        let responseText = "";
        let attempts = 0;
        while (attempts < 30 && !abortRef.current) {
          await new Promise((r) => setTimeout(r, 2000));
          attempts++;

          try {
            const res = await fetch(
              `/api/trpc/sessions.history?input=${encodeURIComponent(
                JSON.stringify({ json: { sessionKey, limit: 10 } })
              )}`
            );
            const data = await res.json();
            const msgs = data?.result?.data?.json?.messages ?? data?.result?.data?.json ?? [];
            const assistantMsgs = msgs.filter(
              (m: { role: string }) => m.role === "assistant"
            );
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
              if (text) {
                responseText = text;
                break;
              }
            }
          } catch {
            // continue polling
          }
        }

        setResponses((prev) =>
          prev.map((r) =>
            r.agentId === agent.id
              ? {
                  ...r,
                  status: responseText ? "done" : "error",
                  content: responseText || "Keine Antwort erhalten.",
                }
              : r
          )
        );
      } catch {
        setResponses((prev) =>
          prev.map((r) =>
            r.agentId === agent.id
              ? { ...r, status: "error", content: "Fehler beim Abrufen der Antwort." }
              : r
          )
        );
      }

      onAgentActive(null);
      // Small pause between agents
      await new Promise((r) => setTimeout(r, 500));
    }

    setPhase("done");
    setIsRunning(false);
    onAgentActive(null);
  }, [topic, selectedAgents, sendMutation, onAgentActive]);

  const generateSummary = async () => {
    setSummaryLoading(true);
    const doneResponses = responses.filter((r) => r.status === "done");
    const summaryText = doneResponses
      .map((r) => `**${r.name} (${r.role}):** ${r.content}`)
      .join("\n\n");

    const sessionKey = `roundtable:summary:${Date.now()}`;
    const prompt = `Fasse folgende Team-Inputs zum Thema "${topic}" in 3-4 Sätzen zusammen. Erkenne Gemeinsamkeiten und wichtigste Punkte:\n\n${summaryText}`;

    try {
      await new Promise<void>((resolve, reject) => {
        sendMutation.mutate(
          { sessionKey, message: prompt, idempotencyKey: crypto.randomUUID() },
          { onSuccess: () => resolve(), onError: reject }
        );
      });

      let summary = "";
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const res = await fetch(
            `/api/trpc/sessions.history?input=${encodeURIComponent(
              JSON.stringify({ json: { sessionKey, limit: 5 } })
            )}`
          );
          const data = await res.json();
          const msgs = data?.result?.data?.json?.messages ?? [];
          const last = msgs.filter((m: { role: string }) => m.role === "assistant").pop();
          if (last) {
            summary =
              typeof last.content === "string"
                ? last.content
                : last.text ?? "";
            if (summary) break;
          }
        } catch {
          // continue
        }
      }
      setManagerSummary(summary || "Zusammenfassung nicht verfügbar.");
    } catch {
      setManagerSummary("Fehler beim Generieren der Zusammenfassung.");
    }
    setSummaryLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-2xl w-[780px] max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Roundtable</h2>
              <p className="text-[11px] text-zinc-500">Alle Agents antworten auf ein Thema</p>
            </div>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm" className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Setup Phase */}
        {phase === "setup" && (
          <div className="flex flex-col gap-4 px-6 py-5">
            {/* Topic */}
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Thema / Frage</label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="z.B. Wie können wir unsere Preise erhöhen ohne Kunden zu verlieren?"
                className="bg-zinc-900 border-zinc-700 text-zinc-100 resize-none h-20"
              />
            </div>

            {/* Agent Picker */}
            <div>
              <button
                onClick={() => setShowAgentPicker((p) => !p)}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {showAgentPicker ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Agents auswählen ({selectedAgents.length}/{ROUNDTABLE_AGENTS.length})
              </button>
              {showAgentPicker && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {ROUNDTABLE_AGENTS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => toggleAgent(a.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all",
                        selectedAgents.includes(a.id)
                          ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-300"
                          : "bg-zinc-900 border-zinc-700/60 text-zinc-500"
                      )}
                    >
                      <span>{a.emoji}</span>
                      <span>{a.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={startRoundtable}
              disabled={!topic.trim() || selectedAgents.length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Roundtable starten
            </Button>
          </div>
        )}

        {/* Running / Done Phase */}
        {(phase === "running" || phase === "done") && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Topic bar */}
            <div className="px-6 py-3 border-b border-zinc-800/40 shrink-0">
              <p className="text-xs text-zinc-500">Thema:</p>
              <p className="text-sm text-zinc-200 font-medium">{topic}</p>
            </div>

            {/* Responses */}
            <ScrollArea className="flex-1 min-h-0 px-6 py-4">
              <div ref={scrollRef} className="space-y-4">
                {responses.map((r) => (
                  <div
                    key={r.agentId}
                    className={cn(
                      "rounded-xl border p-4 transition-all duration-300",
                      r.status === "loading"
                        ? "border-indigo-500/60 bg-indigo-950/30 animate-pulse"
                        : r.status === "done"
                        ? "border-zinc-700/60 bg-zinc-900/50"
                        : r.status === "error"
                        ? "border-red-700/40 bg-red-950/20"
                        : "border-zinc-800/40 bg-zinc-950/40 opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{r.emoji}</span>
                      <span className="text-sm font-semibold text-zinc-200">{r.name}</span>
                      <span className="text-xs text-zinc-500">{r.role}</span>
                      {r.status === "loading" && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400 ml-auto" />
                      )}
                      {r.status === "done" && (
                        <span className="ml-auto text-xs text-emerald-400">✓</span>
                      )}
                    </div>
                    {r.status === "loading" && (
                      <div className="flex gap-1 mt-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
                      </div>
                    )}
                    {(r.status === "done" || r.status === "error") && r.content && (
                      <p className="text-sm text-zinc-300 leading-relaxed">{r.content}</p>
                    )}
                  </div>
                ))}

                {/* Manager Summary */}
                {phase === "done" && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">📋</span>
                      <span className="text-sm font-semibold text-amber-300">Manager Zusammenfassung</span>
                    </div>
                    {!managerSummary && !summaryLoading && (
                      <Button
                        onClick={generateSummary}
                        size="sm"
                        className="bg-amber-600/80 hover:bg-amber-500 text-xs h-7"
                      >
                        Zusammenfassung generieren
                      </Button>
                    )}
                    {summaryLoading && (
                      <div className="flex items-center gap-2 text-xs text-amber-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Manager fasst zusammen...
                      </div>
                    )}
                    {managerSummary && (
                      <p className="text-sm text-zinc-300 leading-relaxed">{managerSummary}</p>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-zinc-800/60 flex items-center justify-between shrink-0">
              {phase === "running" && (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  {responses.filter((r) => r.status === "done").length}/{responses.length} Agents fertig
                </div>
              )}
              {phase === "done" && (
                <span className="text-xs text-emerald-400">
                  ✓ Roundtable abgeschlossen
                </span>
              )}
              <div className="flex gap-2 ml-auto">
                {phase === "done" && (
                  <Button
                    onClick={() => {
                      setPhase("setup");
                      setResponses([]);
                      setManagerSummary(null);
                      setTopic("");
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                  >
                    Neues Thema
                  </Button>
                )}
                {phase === "running" && (
                  <Button
                    onClick={() => {
                      abortRef.current = true;
                      setIsRunning(false);
                      setPhase("done");
                      onAgentActive(null);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-red-400"
                  >
                    Abbrechen
                  </Button>
                )}
                <Button onClick={onClose} variant="ghost" size="sm" className="text-xs h-7">
                  Schließen
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
