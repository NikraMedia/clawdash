"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { unwrapSessions } from "@/lib/gateway/unwrap";
import {
  parseEvents,
  type DelegationPayload,
  type ToolCallPayload,
  type ToolResultPayload,
  type ApprovalPayload,
} from "@/lib/normalize-content";
import { formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  GitBranch,
  Loader2,
  Network,
  Wrench,
  Bot,
  ArrowUp,
  ArrowDown,
  Shield,
} from "lucide-react";
import type { TranscriptMessage } from "./session-workspace";
import type { SessionRow } from "@/lib/gateway/types";

interface OrchestrationPanelProps {
  spawnedBy?: string;
  spawnDepth?: number;
  sessionKey: string;
  messages?: TranscriptMessage[];
}

// ── Execution flow event ────────────────────────────────────────────────

interface FlowEvent {
  id: string;
  type: "tool_call" | "tool_result" | "delegation" | "approval";
  label: string;
  status: "pending" | "active" | "completed" | "error";
  detail?: string;
  timestampMs?: number;
}

// ── Derive orchestration data ───────────────────────────────────────────

interface ToolSummaryRow {
  name: string;
  calls: number;
  successes: number;
  errors: number;
}

function deriveOrchestration(messages: TranscriptMessage[]) {
  if (!messages || messages.length === 0) {
    return { delegations: [], toolSummary: [], flowEvents: [], allEvents: [] };
  }

  const allEvents = messages.flatMap((msg, i) =>
    parseEvents(msg.content ?? msg.text, msg.ts ? String(msg.ts) : `msg-${i}`)
  );

  const delegations = allEvents
    .filter((e) => e.type === "delegation")
    .map((e) => e.payload as DelegationPayload);

  const toolMap = new Map<
    string,
    { calls: number; successes: number; errors: number }
  >();

  for (const e of allEvents) {
    if (e.type === "tool_call") {
      const p = e.payload as ToolCallPayload;
      const entry = toolMap.get(p.toolName) ?? {
        calls: 0,
        successes: 0,
        errors: 0,
      };
      entry.calls++;
      toolMap.set(p.toolName, entry);
    } else if (e.type === "tool_result") {
      const p = e.payload as ToolResultPayload;
      if (p.toolName) {
        const entry = toolMap.get(p.toolName);
        if (entry) {
          if (p.error) entry.errors++;
          else entry.successes++;
        }
      }
    }
  }

  const toolSummary: ToolSummaryRow[] = Array.from(toolMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.calls - a.calls);

  // Execution flow timeline
  const flowEvents: FlowEvent[] = [];
  for (const e of allEvents) {
    if (e.type === "tool_call") {
      const p = e.payload as ToolCallPayload;
      const resultEvent = allEvents.find(
        (r) =>
          r.type === "tool_result" &&
          (r.id === e.id ||
            (r.payload as ToolResultPayload).toolUseId === e.id)
      );
      const hasResult = !!resultEvent;
      const hasError = resultEvent
        ? !!(resultEvent.payload as ToolResultPayload).error
        : false;

      flowEvents.push({
        id: e.id,
        type: "tool_call",
        label: p.toolName,
        status: hasResult
          ? hasError
            ? "error"
            : "completed"
          : "pending",
        detail: hasError
          ? String((resultEvent!.payload as ToolResultPayload).error).slice(
              0,
              80
            )
          : undefined,
        timestampMs: e.timestampMs,
      });
    } else if (e.type === "delegation") {
      const p = e.payload as DelegationPayload;
      flowEvents.push({
        id: e.id,
        type: "delegation",
        label: p.agentId,
        status:
          p.status === "completed"
            ? "completed"
            : p.status === "active"
              ? "active"
              : "pending",
        detail: p.roleDescription || p.handoffSummary || undefined,
        timestampMs: e.timestampMs,
      });
    } else if (e.type === "approval") {
      const p = e.payload as ApprovalPayload;
      flowEvents.push({
        id: e.id,
        type: "approval",
        label: p.actionDescription.slice(0, 60),
        status: p.resolution === "approved"
          ? "completed"
          : p.resolution === "rejected"
            ? "error"
            : "pending",
        timestampMs: e.timestampMs,
      });
    }
  }

  return { delegations, toolSummary, flowEvents, allEvents };
}

// ── Component ───────────────────────────────────────────────────────────

export function OrchestrationPanel({
  spawnedBy,
  spawnDepth,
  sessionKey,
  messages,
}: OrchestrationPanelProps) {
  const trpc = useTRPC();

  const { data: childData, isLoading: childLoading } = useQuery({
    ...trpc.sessions.list.queryOptions({ spawnedBy: sessionKey }),
    refetchInterval: 15_000,
  });

  const childSessions = unwrapSessions(childData);
  const hasParent = !!spawnedBy || (spawnDepth != null && spawnDepth > 0);
  const hasChildren = childSessions.length > 0;

  const { delegations, toolSummary, flowEvents } = useMemo(
    () => deriveOrchestration(messages ?? []),
    [messages]
  );

  const hasOrchestration =
    hasParent ||
    hasChildren ||
    delegations.length > 0 ||
    toolSummary.length > 0;

  if (!hasOrchestration && !childLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
            <Network className="h-3.5 w-3.5 text-zinc-500" />
            Orchestration
          </h3>
          <SessionIdentity sessionKey={sessionKey} spawnDepth={spawnDepth} />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <EmptyState
            icon={GitBranch}
            title="Single-Agent Session"
            description="This session has no sub-agents or orchestration activity. Tool calls and delegations will appear here as the agent works."
            className="min-h-[280px] border-0 bg-transparent shadow-none ring-0"
          />
        </div>
      </div>
    );
  }

  const defaultOpen: string[] = [];
  if (hasParent || hasChildren) defaultOpen.push("hierarchy");
  if (flowEvents.length > 0) defaultOpen.push("flow");
  if (toolSummary.length > 0) defaultOpen.push("tools");

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-zinc-500" />
          Orchestration
        </h3>
        <SessionIdentity sessionKey={sessionKey} spawnDepth={spawnDepth} />
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {childLoading && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 px-4 py-3">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading orchestration data...
          </div>
        )}

        <Accordion
          type="multiple"
          defaultValue={defaultOpen}
          className="px-3 pb-4"
        >
          {(hasParent || hasChildren) && (
            <AccordionItem value="hierarchy" className="border-zinc-800/60">
              <AccordionTrigger className="py-3 text-xs font-semibold text-zinc-400 hover:no-underline">
                Agent Hierarchy
              </AccordionTrigger>
              <AccordionContent>
                <AgentHierarchy
                  sessionKey={sessionKey}
                  spawnedBy={spawnedBy}
                  childSessions={childSessions}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {flowEvents.length > 0 && (
            <AccordionItem value="flow" className="border-zinc-800/60">
              <AccordionTrigger className="py-3 text-xs font-semibold text-zinc-400 hover:no-underline">
                <span className="flex items-center gap-2">
                  Execution Flow
                  <span className="text-[10px] text-zinc-600 font-normal tabular-nums">
                    {flowEvents.length} events
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ExecutionFlow events={flowEvents} />
              </AccordionContent>
            </AccordionItem>
          )}

          {toolSummary.length > 0 && (
            <AccordionItem value="tools" className="border-zinc-800/60">
              <AccordionTrigger className="py-3 text-xs font-semibold text-zinc-400 hover:no-underline">
                <span className="flex items-center gap-2">
                  Tool Summary
                  <span className="text-[10px] text-zinc-600 font-normal tabular-nums">
                    {toolSummary.reduce((s, t) => s + t.calls, 0)} calls
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ToolSummaryTable tools={toolSummary} />
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function SessionIdentity({
  sessionKey,
  spawnDepth,
}: {
  sessionKey: string;
  spawnDepth?: number;
}) {
  const truncatedKey =
    sessionKey.length > 30 ? sessionKey.slice(0, 27) + "..." : sessionKey;

  return (
    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500">
      <span className="font-mono truncate">{truncatedKey}</span>
      {spawnDepth != null && spawnDepth > 0 && (
        <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
          depth {spawnDepth}
        </span>
      )}
    </div>
  );
}

function AgentHierarchy({
  sessionKey,
  spawnedBy,
  childSessions,
}: {
  sessionKey: string;
  spawnedBy?: string;
  childSessions: SessionRow[];
}) {
  return (
    <div className="space-y-2">
      {spawnedBy && (
        <Link
          href={`/sessions/${encodeURIComponent(spawnedBy)}`}
          className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-3 py-2 transition-colors hover:bg-zinc-800/40 group"
        >
          <ArrowUp className="h-3 w-3 text-zinc-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
              Parent
            </div>
            <div className="text-xs text-blue-400 group-hover:text-blue-300 truncate font-mono">
              {spawnedBy.length > 25 ? spawnedBy.slice(0, 22) + "..." : spawnedBy}
            </div>
          </div>
        </Link>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-indigo-900/40 bg-indigo-950/20 px-3 py-2">
        <div className="h-2 w-2 rounded-full bg-indigo-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-indigo-400/70 font-semibold uppercase tracking-wider">
            Current
          </div>
          <div className="text-xs text-zinc-300 truncate font-mono">
            {sessionKey.length > 25
              ? sessionKey.slice(0, 22) + "..."
              : sessionKey}
          </div>
        </div>
      </div>

      {childSessions.length > 0 && (
        <div className="space-y-1.5 pl-3 border-l-2 border-zinc-800/60">
          {childSessions.map((child) => (
            <Link
              key={child.key}
              href={`/sessions/${encodeURIComponent(child.key)}`}
              className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-3 py-2 transition-colors hover:bg-zinc-800/40 group"
            >
              <ArrowDown className="h-3 w-3 text-zinc-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-zinc-300 group-hover:text-zinc-100 truncate">
                  {child.label ?? child.derivedTitle ?? child.key.split(":")[1] ?? child.key}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                  {child.model && (
                    <span className="font-mono">{child.model}</span>
                  )}
                  {child.totalTokens ? (
                    <span className="tabular-nums">
                      {formatTokens(child.totalTokens)}
                    </span>
                  ) : null}
                  <span>{child.kind}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ExecutionFlow({ events }: { events: FlowEvent[] }) {
  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-2.5">
          <div className="flex flex-col items-center w-4 shrink-0">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full shrink-0 mt-1",
                event.status === "completed"
                  ? "bg-emerald-400"
                  : event.status === "error"
                    ? "bg-red-400"
                    : event.status === "active"
                      ? "bg-indigo-400"
                      : "bg-amber-400"
              )}
            />
            {i < events.length - 1 && (
              <div className="flex-1 w-px bg-zinc-800 min-h-[16px]" />
            )}
          </div>

          <div className="pb-3 min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {event.type === "tool_call" && (
                <Wrench className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
              )}
              {event.type === "delegation" && (
                <Bot className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
              )}
              {event.type === "approval" && (
                <Shield className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
              )}
              <span className="text-[11px] text-zinc-300 font-mono truncate">
                {event.label}
              </span>
              <span
                className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-medium",
                  event.status === "completed"
                    ? "text-emerald-400 bg-emerald-950/40"
                    : event.status === "error"
                      ? "text-red-400 bg-red-950/40"
                      : event.status === "active"
                        ? "text-indigo-400 bg-indigo-950/40"
                        : "text-amber-400 bg-amber-950/40"
                )}
              >
                {event.status === "pending" && event.type === "tool_call"
                  ? "running"
                  : event.status}
              </span>
            </div>
            {event.detail && (
              <div className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">
                {event.detail}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ToolSummaryTable({ tools }: { tools: ToolSummaryRow[] }) {
  const maxCalls = Math.max(...tools.map((t) => t.calls), 1);

  return (
    <div className="space-y-0">
      <div className="grid grid-cols-[1fr_40px_40px_40px] gap-1 text-[9px] text-zinc-600 font-semibold uppercase tracking-wider pb-1.5 border-b border-zinc-800/40 mb-1.5">
        <span>Tool</span>
        <span className="text-right">Calls</span>
        <span className="text-right text-emerald-600">OK</span>
        <span className="text-right text-red-600">Err</span>
      </div>
      {tools.map((tool) => (
        <div key={tool.name} className="py-1">
          <div className="grid grid-cols-[1fr_40px_40px_40px] gap-1 items-center text-[10px]">
            <span className="font-mono text-zinc-300 truncate">
              {tool.name}
            </span>
            <span className="text-right text-zinc-400 tabular-nums">
              {tool.calls}
            </span>
            <span className="text-right text-emerald-500 tabular-nums">
              {tool.successes || "\u2014"}
            </span>
            <span
              className={cn(
                "text-right tabular-nums",
                tool.errors > 0 ? "text-red-400" : "text-zinc-600"
              )}
            >
              {tool.errors || "\u2014"}
            </span>
          </div>
          <div className="h-0.5 rounded-full bg-zinc-800/60 mt-1 overflow-hidden">
            <div
              className="h-full rounded-full bg-zinc-600/40"
              style={{ width: `${(tool.calls / maxCalls) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
