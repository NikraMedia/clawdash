"use client";

import { useMemo, useContext } from "react";
import {
  BarChart3,
  Cpu,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import {
  parseEvents,
  type ParsedEvent,
  type ToolCallPayload,
  type ToolResultPayload,
  type ThoughtPayload,
  type DelegationPayload,
  type ApprovalPayload,
} from "@/lib/normalize-content";
import { formatTokens } from "@/lib/format";
import { SessionStreamContext } from "@/hooks/use-session-stream";
import type { TranscriptMessage, SessionMeta } from "./session-workspace";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

// ── Derived data types ──────────────────────────────────────────────────

interface ToolStats {
  name: string;
  calls: number;
  successes: number;
  errors: number;
  isPending: boolean;
}

interface DecisionEntry {
  type: "approval" | "delegation" | "error";
  description: string;
  status?: string;
  timestampMs?: number;
}

interface DerivedInsights {
  allEvents: ParsedEvent[];
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  tools: ToolStats[];
  thoughts: { summary: string; tokens: number }[];
  totalThoughtTokens: number;
  decisions: DecisionEntry[];
  firstMessageTs: number | null;
  hasActivity: boolean;
}

// ── Derivation logic ────────────────────────────────────────────────────

function deriveInsights(messages: TranscriptMessage[]): DerivedInsights {
  if (!messages || messages.length === 0) {
    return {
      allEvents: [],
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      toolCalls: 0,
      toolResults: 0,
      tools: [],
      thoughts: [],
      totalThoughtTokens: 0,
      decisions: [],
      firstMessageTs: null,
      hasActivity: false,
    };
  }

  const allEvents = messages.flatMap((msg, i) =>
    parseEvents(msg.content ?? msg.text, msg.ts ? String(msg.ts) : `msg-${i}`)
  );

  let userMessages = 0;
  let assistantMessages = 0;
  for (const msg of messages) {
    if (msg.role === "user") userMessages++;
    else if (msg.role === "assistant") assistantMessages++;
  }

  // Tool stats
  const toolMap = new Map<
    string,
    { calls: number; successes: number; errors: number; lastCallId?: string }
  >();
  const pendingToolIds = new Set<string>();

  for (const e of allEvents) {
    if (e.type === "tool_call") {
      const p = e.payload as ToolCallPayload;
      const entry = toolMap.get(p.toolName) ?? {
        calls: 0,
        successes: 0,
        errors: 0,
      };
      entry.calls++;
      entry.lastCallId = e.id;
      toolMap.set(p.toolName, entry);
      pendingToolIds.add(e.id);
    } else if (e.type === "tool_result") {
      const p = e.payload as ToolResultPayload;
      const name = p.toolName;
      if (name) {
        const entry = toolMap.get(name);
        if (entry) {
          if (p.error) entry.errors++;
          else entry.successes++;
        }
      }
      if (p.toolUseId) pendingToolIds.delete(p.toolUseId);
      pendingToolIds.delete(e.id);
    }
  }

  const tools: ToolStats[] = Array.from(toolMap.entries())
    .map(([name, stats]) => ({
      name,
      calls: stats.calls,
      successes: stats.successes,
      errors: stats.errors,
      isPending: stats.lastCallId
        ? pendingToolIds.has(stats.lastCallId)
        : false,
    }))
    .sort((a, b) => b.calls - a.calls);

  // Thoughts
  const thoughts: { summary: string; tokens: number }[] = [];
  let totalThoughtTokens = 0;
  for (const e of allEvents) {
    if (e.type === "thought") {
      const p = e.payload as ThoughtPayload;
      const tokens = p.tokenCountEstimate ?? Math.ceil(p.rawText.length / 4);
      totalThoughtTokens += tokens;
      thoughts.push({
        summary:
          p.rawText.length > 80
            ? p.rawText.slice(0, 77) + "..."
            : p.rawText,
        tokens,
      });
    }
  }

  // Decisions
  const decisions: DecisionEntry[] = [];
  for (const e of allEvents) {
    if (e.type === "approval") {
      const p = e.payload as ApprovalPayload;
      decisions.push({
        type: "approval",
        description: p.actionDescription,
        status: p.resolution ?? "pending",
        timestampMs: e.timestampMs,
      });
    } else if (e.type === "delegation") {
      const p = e.payload as DelegationPayload;
      decisions.push({
        type: "delegation",
        description: `Delegated to ${p.agentId}`,
        status: p.status,
        timestampMs: e.timestampMs,
      });
    } else if (e.type === "tool_result") {
      const p = e.payload as ToolResultPayload;
      if (p.error) {
        decisions.push({
          type: "error",
          description: `${p.toolName ?? "Tool"}: ${typeof p.error === "string" ? p.error.slice(0, 100) : "Error"}`,
          status: "error",
          timestampMs: e.timestampMs,
        });
      }
    }
  }

  const firstTs = messages[0]?.ts ?? null;

  return {
    allEvents,
    totalMessages: messages.length,
    userMessages,
    assistantMessages,
    toolCalls: allEvents.filter((e) => e.type === "tool_call").length,
    toolResults: allEvents.filter((e) => e.type === "tool_result").length,
    tools,
    thoughts,
    totalThoughtTokens,
    decisions,
    firstMessageTs: firstTs ? firstTs : null,
    hasActivity: messages.length > 0,
  };
}

// ── Component ───────────────────────────────────────────────────────────

interface InsightsPanelProps {
  session: SessionMeta;
  messages: TranscriptMessage[];
  isStreaming?: boolean;
  streamContent?: string;
}

export function InsightsPanel({
  session,
  messages,
  isStreaming,
  streamContent,
}: InsightsPanelProps) {
  const streamCtx = useContext(SessionStreamContext);
  const isConnected = streamCtx?.state.connected ?? false;
  const streaming = isStreaming ?? streamCtx?.state.isStreaming ?? false;

  const insights = useMemo(() => deriveInsights(messages), [messages]);

  if (!insights.hasActivity) {
    return (
      <div className="flex flex-col h-full">
        <StatusHeader
          session={session}
          isStreaming={streaming}
          isConnected={isConnected}
          streamContent={streamContent}
          insights={insights}
        />
        <div className="flex-1 flex items-center justify-center p-4">
          <EmptyState
            icon={BarChart3}
            title="No Activity Yet"
            description="Send a message to start the session. Insights will appear as the conversation progresses."
            className="min-h-[280px] border-0 bg-transparent shadow-none ring-0"
          />
        </div>
      </div>
    );
  }

  const defaultOpen: string[] = ["tokens"];
  if (insights.tools.length > 0) defaultOpen.push("tools");
  if (insights.decisions.length > 0) defaultOpen.push("decisions");

  return (
    <div className="flex flex-col h-full">
      <StatusHeader
        session={session}
        isStreaming={streaming}
        isConnected={isConnected}
        streamContent={streamContent}
        insights={insights}
      />
      <div className="flex-1 overflow-auto min-h-0">
        <Accordion
          type="multiple"
          defaultValue={defaultOpen}
          className="px-3 pb-4"
        >
          <AccordionItem value="tokens" className="border-zinc-800/60">
            <AccordionTrigger className="py-3 text-xs font-semibold text-zinc-400 hover:no-underline">
              Token Usage
            </AccordionTrigger>
            <AccordionContent>
              <TokenEconomy session={session} />
            </AccordionContent>
          </AccordionItem>

          {insights.tools.length > 0 && (
            <AccordionItem value="tools" className="border-zinc-800/60">
              <AccordionTrigger className="py-3 text-xs font-semibold text-zinc-400 hover:no-underline">
                <span className="flex items-center gap-2">
                  Tool Activity
                  <span className="text-[10px] text-zinc-600 font-normal tabular-nums">
                    {insights.toolCalls} calls
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ToolActivity tools={insights.tools} />
              </AccordionContent>
            </AccordionItem>
          )}

          {insights.thoughts.length > 0 && (
            <AccordionItem value="reasoning" className="border-zinc-800/60">
              <AccordionTrigger className="py-3 text-xs font-semibold text-zinc-400 hover:no-underline">
                <span className="flex items-center gap-2">
                  Reasoning
                  <span className="text-[10px] text-zinc-600 font-normal tabular-nums">
                    {insights.thoughts.length} blocks · ~
                    {formatTokens(insights.totalThoughtTokens)}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ReasoningSummary thoughts={insights.thoughts} />
              </AccordionContent>
            </AccordionItem>
          )}

          {insights.decisions.length > 0 && (
            <AccordionItem value="decisions" className="border-zinc-800/60">
              <AccordionTrigger className="py-3 text-xs font-semibold text-zinc-400 hover:no-underline">
                <span className="flex items-center gap-2">
                  Key Decisions
                  <span className="text-[10px] text-zinc-600 font-normal tabular-nums">
                    {insights.decisions.length}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <KeyDecisions decisions={insights.decisions} />
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="flow" className="border-zinc-800/60">
            <AccordionTrigger className="py-3 text-xs font-semibold text-zinc-400 hover:no-underline">
              <span className="flex items-center gap-2">
                Message Flow
                <span className="text-[10px] text-zinc-600 font-normal tabular-nums">
                  {insights.totalMessages} turns · {insights.toolCalls} tool
                  calls
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <MessageFlow messages={messages} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function StatusHeader({
  session,
  isStreaming,
  isConnected,
  streamContent,
  insights,
}: {
  session: SessionMeta;
  isStreaming: boolean;
  isConnected: boolean;
  streamContent?: string;
  insights: DerivedInsights;
}) {
  const hasMessages = insights.totalMessages > 0;
  const isCompleted = hasMessages && !isStreaming;

  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-zinc-500" />
          Insights
        </h3>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
            isStreaming
              ? "text-indigo-400 bg-indigo-500/10"
              : isCompleted
                ? "text-emerald-500 bg-emerald-500/10"
                : isConnected
                  ? "text-zinc-400 bg-zinc-800/50"
                  : "text-zinc-500 bg-zinc-800/30"
          )}
        >
          {isStreaming ? (
            <>
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400" />
              </span>
              Streaming
            </>
          ) : isCompleted ? (
            <>
              <CheckCircle2 className="h-2.5 w-2.5" />
              Completed
            </>
          ) : isConnected ? (
            <>
              <Wifi className="h-2.5 w-2.5" />
              Idle
            </>
          ) : (
            <>
              <WifiOff className="h-2.5 w-2.5" />
              Disconnected
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-[10px] text-zinc-500">
        {session.model && (
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800/60 px-1.5 py-0.5 font-mono text-zinc-400">
            <Cpu className="h-2.5 w-2.5" />
            {session.model}
          </span>
        )}
        {session.thinkingLevel && (
          <span className="rounded-md bg-purple-950/30 px-1.5 py-0.5 text-purple-400/80">
            thinking: {session.thinkingLevel}
          </span>
        )}
        {session.origin?.surface && (
          <span className="text-zinc-600">{session.origin.surface}</span>
        )}
        {session.channel && (
          <span className="text-zinc-600">#{session.channel}</span>
        )}
      </div>

      {isStreaming && streamContent && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-indigo-400/70">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          <span className="tabular-nums">
            {streamContent.split(/\s+/).filter(Boolean).length} words generated
          </span>
        </div>
      )}
    </div>
  );
}

function TokenEconomy({ session }: { session: SessionMeta }) {
  const input = session.inputTokens ?? 0;
  const output = session.outputTokens ?? 0;
  const total = session.totalTokens ?? 0;
  const context = session.contextTokens ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Input" value={formatTokens(input)} color="text-blue-400" />
        <StatCard label="Output" value={formatTokens(output)} color="text-emerald-400" />
        <StatCard label="Total" value={formatTokens(total)} color="text-zinc-200" />
      </div>
      {context > 0 && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
            <span>Context Window</span>
            <span className="tabular-nums">{formatTokens(context)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500/60 to-indigo-500/60 transition-all duration-500"
              style={{
                width: `${Math.min(100, (context / 200_000) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-2.5 py-2 text-center">
      <div className={cn("text-sm font-semibold tabular-nums", color)}>
        {value}
      </div>
      <div className="text-[10px] text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}

function ToolActivity({ tools }: { tools: ToolStats[] }) {
  const maxCalls = Math.max(...tools.map((t) => t.calls), 1);
  const visible = tools.slice(0, 8);
  const overflow = tools.length - 8;

  return (
    <div className="space-y-1.5">
      {visible.map((tool) => (
        <div key={tool.name} className="group">
          <div className="flex items-center gap-2 text-[10px]">
            {tool.isPending && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
              </span>
            )}
            <span className="font-mono text-zinc-300 truncate min-w-0 flex-1">
              {tool.name}
            </span>
            <span className="tabular-nums text-zinc-500 shrink-0">
              {tool.calls}
            </span>
            {tool.errors > 0 && (
              <span className="text-red-400 shrink-0">
                {tool.errors} err
              </span>
            )}
          </div>
          <div className="h-1 rounded-full bg-zinc-800 mt-0.5 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                tool.errors > 0 && tool.successes === 0
                  ? "bg-red-500/50"
                  : tool.isPending
                    ? "bg-amber-500/50"
                    : "bg-emerald-500/40"
              )}
              style={{
                width: `${(tool.calls / maxCalls) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <div className="text-[10px] text-zinc-600 pt-1">
          +{overflow} more tools
        </div>
      )}
    </div>
  );
}

function ReasoningSummary({
  thoughts,
}: {
  thoughts: { summary: string; tokens: number }[];
}) {
  return (
    <div className="space-y-2">
      {thoughts.map((t, i) => (
        <div
          key={i}
          className="rounded-md border border-purple-900/20 bg-purple-950/10 px-3 py-2"
        >
          <div className="text-[10px] text-purple-300/70 italic leading-relaxed line-clamp-2">
            {t.summary}
          </div>
          <div className="text-[9px] text-zinc-600 mt-1 tabular-nums">
            ~{t.tokens.toLocaleString()} tokens
          </div>
        </div>
      ))}
    </div>
  );
}

function KeyDecisions({ decisions }: { decisions: DecisionEntry[] }) {
  return (
    <div className="space-y-1.5">
      {decisions.map((d, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-md border border-zinc-800/40 bg-zinc-900/20 px-2.5 py-1.5"
        >
          <div
            className={cn(
              "mt-0.5 h-1.5 w-1.5 rounded-full shrink-0",
              d.type === "approval"
                ? d.status === "approved"
                  ? "bg-emerald-400"
                  : d.status === "rejected"
                    ? "bg-red-400"
                    : "bg-amber-400"
                : d.type === "delegation"
                  ? d.status === "completed"
                    ? "bg-emerald-400"
                    : d.status === "active"
                      ? "bg-indigo-400"
                      : "bg-amber-400"
                  : "bg-red-400"
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-zinc-300 leading-relaxed truncate">
              {d.description}
            </div>
            {d.status && (
              <span
                className={cn(
                  "text-[9px] font-medium",
                  d.status === "approved" || d.status === "completed"
                    ? "text-emerald-500"
                    : d.status === "rejected" || d.status === "error"
                      ? "text-red-400"
                      : d.status === "active"
                        ? "text-indigo-400"
                        : "text-amber-400"
                )}
              >
                {d.status}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageFlow({ messages }: { messages: TranscriptMessage[] }) {
  const maxLen = useMemo(() => {
    let max = 1;
    for (const msg of messages) {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : typeof msg.text === "string"
            ? msg.text
            : "";
      if (text.length > max) max = text.length;
    }
    return max;
  }, [messages]);

  return (
    <div className="space-y-0.5">
      {messages.map((msg, i) => {
        const text =
          typeof msg.content === "string"
            ? msg.content
            : typeof msg.text === "string"
              ? msg.text
              : "";
        const width = Math.max(8, (text.length / maxLen) * 100);
        const isUser = msg.role === "user";
        const isTool =
          msg.role === "tool" || msg.role === "toolResult" || !!msg.toolName;

        return (
          <div key={i} className="flex items-center gap-1.5 h-2">
            <span className="text-[8px] text-zinc-600 w-3 text-right shrink-0 tabular-nums">
              {i + 1}
            </span>
            <div
              className={cn(
                "h-1.5 rounded-full transition-all",
                isUser
                  ? "bg-blue-500/40"
                  : isTool
                    ? "bg-amber-500/40"
                    : "bg-zinc-600/40"
              )}
              style={{ width: `${width}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
