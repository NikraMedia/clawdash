"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTRPC } from "@/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { EventCard } from "./event-card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { Activity, AlertCircle, AlertTriangle, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import type { ActivityAgentOption, FilterState } from "./filters";

interface EventFeedProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  agents: ActivityAgentOption[];
}

interface StreamEvent {
  id: number;
  event: string;
  payload?: unknown;
  timestamp: number;
  severity: "info" | "warning" | "error";
  agentId?: string;
}

export function EventFeed({ filters, onChange, agents }: EventFeedProps) {
  const trpc = useTRPC();
  const previousTopByFilterRef = useRef(new Map<string, number | null>());
  const [freshnessSnapshot, setFreshnessSnapshot] = useState<{
    count: number;
    ids: number[];
  }>({ count: 0, ids: [] });
  const filterSignature = `${filters.showAll}-${filters.agentId}-${filters.eventType}-${filters.severity}`;

  const queryInput = useMemo(
    () => ({
      showAll: filters.showAll || undefined,
      agentId: filters.agentId || undefined,
      eventType: filters.eventType || undefined,
      severity: filters.severity || undefined,
      limit: 200,
    }),
    [filters.agentId, filters.eventType, filters.severity, filters.showAll]
  );

  const { data, isLoading, isError, isFetching, error, refetch, dataUpdatedAt } =
    useQuery({
      ...trpc.system.activity.queryOptions(queryInput),
      refetchInterval: 5000,
    });

  const events = useMemo<StreamEvent[]>(() => data?.events ?? [], [data?.events]);
  const hasActiveFilters =
    filters.showAll || !!filters.agentId || !!filters.eventType || !!filters.severity;

  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents]
  );

  const severityCounts = useMemo(
    () =>
      events.reduce(
        (counts, event) => {
          counts[event.severity] += 1;
          return counts;
        },
        { info: 0, warning: 0, error: 0 }
      ),
    [events]
  );

  const mostActiveAgent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      if (!event.agentId) continue;
      counts.set(event.agentId, (counts.get(event.agentId) ?? 0) + 1);
    }
    if (counts.size === 0) return null;

    const [agentId, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const agent = agentsById.get(agentId);
    return {
      id: agentId,
      count,
      label: `${agent?.emoji ? `${agent.emoji} ` : ""}${agent?.name ?? agentId}`,
    };
  }, [agentsById, events]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      setFreshnessSnapshot({ count: 0, ids: [] })
    );
    return () => window.cancelAnimationFrame(frame);
  }, [filterSignature]);

  useEffect(() => {
    const topId = events[0]?.id;
    const previousTopId = previousTopByFilterRef.current.get(filterSignature);

    let nextSnapshot = { count: 0, ids: [] as number[] };
    if (typeof topId === "number") {
      if (typeof previousTopId === "number" && topId > previousTopId) {
        const incoming = events
          .filter((event) => event.id > previousTopId)
          .map((event) => event.id);
        nextSnapshot = { count: incoming.length, ids: incoming };
      }
      previousTopByFilterRef.current.set(filterSignature, topId);
    } else {
      previousTopByFilterRef.current.set(filterSignature, null);
    }

    const frame = window.requestAnimationFrame(() =>
      setFreshnessSnapshot((previous) => {
        if (
          previous.count === nextSnapshot.count &&
          previous.ids.length === nextSnapshot.ids.length &&
          previous.ids.every((id, index) => id === nextSnapshot.ids[index])
        ) {
          return previous;
        }
        return nextSnapshot;
      })
    );

    return () => window.cancelAnimationFrame(frame);
  }, [events, filterSignature]);

  const newEventCount = freshnessSnapshot.count;
  const freshEventIdSet = useMemo(
    () => new Set(freshnessSnapshot.ids),
    [freshnessSnapshot.ids]
  );
  const lastUpdatedAt = dataUpdatedAt > 0 ? dataUpdatedAt : null;

  const handleEventTypeClick = useCallback(
    (eventType: string) => {
      if (filters.eventType === eventType) return;
      onChange({ ...filters, eventType });
    },
    [filters, onChange]
  );

  const handleSeverityClick = useCallback(
    (severity: "info" | "warning" | "error") => {
      onChange({
        ...filters,
        severity: filters.severity === severity ? "" : severity,
      });
    },
    [filters, onChange]
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-zinc-700/70 bg-zinc-950/70 px-2 py-0.5 text-[11px] text-zinc-300"
          >
            {isLoading
              ? "Loading stream"
              : `${events.length} event${events.length === 1 ? "" : "s"}`}
          </Badge>
          <Badge
            variant="outline"
            className="border-zinc-700/70 bg-zinc-950/70 px-2 py-0.5 text-[11px] text-zinc-300"
          >
            {data?.meta.totalBuffered ?? 0} buffered
          </Badge>
          {mostActiveAgent && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, agentId: mostActiveAgent.id })}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                filters.agentId === mostActiveAgent.id
                  ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                  : "border-zinc-700/70 bg-zinc-950/70 text-zinc-300 hover:border-zinc-500/80 hover:bg-zinc-900"
              )}
            >
              top agent: {mostActiveAgent.label} ({mostActiveAgent.count})
            </button>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-70",
                  isFetching ? "animate-ping bg-emerald-500" : "bg-zinc-600"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  isFetching ? "bg-emerald-400" : "bg-zinc-500"
                )}
              />
            </span>
            {lastUpdatedAt ? `updated ${formatRelativeTime(lastUpdatedAt)}` : "waiting"}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={() =>
              onChange({ ...filters, severity: filters.severity === "error" ? "" : "error" })
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 transition-colors",
              filters.severity === "error"
                ? "border-red-500/45 bg-red-500/20 text-red-200"
                : "border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/15"
            )}
          >
            <AlertCircle className="size-3.5" />
            {severityCounts.error} error
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                severity: filters.severity === "warning" ? "" : "warning",
              })
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 transition-colors",
              filters.severity === "warning"
                ? "border-amber-500/45 bg-amber-500/20 text-amber-200"
                : "border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15"
            )}
          >
            <AlertTriangle className="size-3.5" />
            {severityCounts.warning} warning
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({ ...filters, severity: filters.severity === "info" ? "" : "info" })
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 transition-colors",
              filters.severity === "info"
                ? "border-sky-500/45 bg-sky-500/20 text-sky-200"
                : "border-sky-500/25 bg-sky-500/10 text-sky-300 hover:bg-sky-500/15"
            )}
          >
            <CircleDot className="size-3.5" />
            {severityCounts.info} info
          </button>
          {newEventCount > 0 && (
            <span
              className="ml-auto rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300"
              aria-live="polite"
            >
              {newEventCount} new since last refresh
            </span>
          )}
        </div>
      </div>

      {isError && (
        <div className="mt-1">
          <QueryError error={error} label="activity events" onRetry={() => refetch()} />
        </div>
      )}

      {!isError && isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="ml-8 h-20 animate-pulse rounded-xl border border-zinc-800/60 bg-glass shadow-md"
            />
          ))}
        </div>
      )}

      {!isError && !isLoading && events.length === 0 && (
        <div className="mt-4">
          <EmptyState
            icon={Activity}
            title={
              hasActiveFilters
                ? "No events match current filters"
                : "No events captured yet"
            }
            description={
              hasActiveFilters
                ? "Try clearing one or more filters to widen the stream."
                : "Events will appear here as the OpenClaw gateway emits them."
            }
            action={
              hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({
                      showAll: false,
                      agentId: "",
                      eventType: "",
                      severity: "",
                    })
                  }
                  className="border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      {!isError && !isLoading && events.length > 0 && (
        <div className="flex flex-col w-full relative">
          {events.map((event, idx) => (
            <EventCard
              key={event.id}
              event={event}
              isLast={idx === events.length - 1}
              isFresh={freshEventIdSet.has(event.id)}
              agent={event.agentId ? agentsById.get(event.agentId) : undefined}
              onEventTypeClick={handleEventTypeClick}
              onSeverityClick={handleSeverityClick}
              isSeverityActive={filters.severity === event.severity}
            />
          ))}
        </div>
      )}
    </div>
  );
}
