"use client";

import { useMemo, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterState {
  showAll: boolean;
  agentId: string;
  eventType: string;
  severity: string;
}

export interface ActivityAgentOption {
  id: string;
  name?: string;
  emoji?: string;
}

interface FiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  agents: ActivityAgentOption[];
  eventTypes: string[];
}

function FilterPill({
  active,
  onClick,
  children,
  variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  variant?: "default" | "error" | "warning" | "info";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    default: active
      ? "border-zinc-500/80 bg-zinc-100 text-zinc-900 shadow-sm"
      : "border-zinc-800/80 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700/80 hover:bg-zinc-800/80 hover:text-zinc-300",
    error: active
      ? "border-red-500/50 bg-red-500/20 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.25)]"
      : "border-zinc-800/80 bg-zinc-900/50 text-zinc-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300",
    warning: active
      ? "border-amber-500/50 bg-amber-500/20 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]"
      : "border-zinc-800/80 bg-zinc-900/50 text-zinc-400 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300",
    info: active
      ? "border-sky-500/50 bg-sky-500/20 text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.25)]"
      : "border-zinc-800/80 bg-zinc-900/50 text-zinc-400 hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-300",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(base, variants[variant])}
    >
      {children}
    </button>
  );
}

export function Filters({
  filters,
  onChange,
  agents,
  eventTypes,
}: FiltersProps) {
  const sortedEventTypes = useMemo(
    () => [...new Set(eventTypes)].sort((a, b) => a.localeCompare(b)),
    [eventTypes]
  );

  const hasActiveFilters =
    filters.showAll || !!filters.agentId || !!filters.eventType || !!filters.severity;

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === filters.agentId),
    [agents, filters.agentId]
  );

  const clearAllFilters = () => {
    onChange({
      showAll: false,
      agentId: "",
      eventType: "",
      severity: "",
    });
  };

  const formatAgentLabel = (agent: ActivityAgentOption) =>
    `${agent.emoji ? `${agent.emoji} ` : ""}${agent.name ?? agent.id}`;

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-4 shadow-inner">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-zinc-100">Event Stream Filters</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Narrow by event type, agent, and severity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-7 rounded-full border border-zinc-700/70 bg-zinc-900/70 px-2.5 text-zinc-300 hover:bg-zinc-800"
                onClick={clearAllFilters}
              >
                <X className="size-3" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        <label className="inline-flex w-fit items-center gap-2.5 rounded-full border border-zinc-800/70 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
          <Switch
            checked={filters.showAll}
            onCheckedChange={(checked) => onChange({ ...filters, showAll: checked })}
            className="scale-90 data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-zinc-800"
          />
          Include Buffered Events
        </label>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {filters.showAll && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/15"
                onClick={() => onChange({ ...filters, showAll: false })}
              >
                buffered
                <X className="size-3" />
              </button>
            )}
            {filters.agentId && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-zinc-700/80 bg-zinc-900/70 px-2 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-500/80 hover:bg-zinc-800/80"
                onClick={() => onChange({ ...filters, agentId: "" })}
              >
                agent: {selectedAgent ? formatAgentLabel(selectedAgent) : filters.agentId}
                <X className="size-3" />
              </button>
            )}
            {filters.eventType && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-zinc-700/80 bg-zinc-900/70 px-2 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-500/80 hover:bg-zinc-800/80"
                onClick={() => onChange({ ...filters, eventType: "" })}
              >
                type: {filters.eventType}
                <X className="size-3" />
              </button>
            )}
            {filters.severity && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-zinc-700/80 bg-zinc-900/70 px-2 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-500/80 hover:bg-zinc-800/80"
                onClick={() => onChange({ ...filters, severity: "" })}
              >
                severity: {filters.severity}
                <X className="size-3" />
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            Event Type
          </span>
          <ScrollArea className="w-full whitespace-nowrap pb-2">
            <div className="flex w-max items-center gap-2">
              <FilterPill
                active={filters.eventType === ""}
                onClick={() => onChange({ ...filters, eventType: "" })}
              >
                All Events
              </FilterPill>
              {sortedEventTypes.map((eventType) => (
                <FilterPill
                  key={eventType}
                  active={filters.eventType === eventType}
                  onClick={() => onChange({ ...filters, eventType })}
                >
                  {eventType}
                </FilterPill>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            Agent
          </span>
          <ScrollArea className="w-full whitespace-nowrap pb-2">
            <div className="flex w-max items-center gap-2">
              <FilterPill
                active={filters.agentId === ""}
                onClick={() => onChange({ ...filters, agentId: "" })}
              >
                All Agents
              </FilterPill>
              {agents.map((agent) => (
                <FilterPill
                  key={agent.id}
                  active={filters.agentId === agent.id}
                  onClick={() => onChange({ ...filters, agentId: agent.id })}
                >
                  {formatAgentLabel(agent)}
                </FilterPill>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            Severity
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              active={filters.severity === ""}
              onClick={() => onChange({ ...filters, severity: "" })}
            >
              All Severities
            </FilterPill>
            <FilterPill
              active={filters.severity === "error"}
              onClick={() => onChange({ ...filters, severity: "error" })}
              variant="error"
            >
              <AlertCircle className="size-3.5" />
              Error
            </FilterPill>
            <FilterPill
              active={filters.severity === "warning"}
              onClick={() => onChange({ ...filters, severity: "warning" })}
              variant="warning"
            >
              <AlertTriangle className="size-3.5" />
              Warning
            </FilterPill>
            <FilterPill
              active={filters.severity === "info"}
              onClick={() => onChange({ ...filters, severity: "info" })}
              variant="info"
            >
              <Info className="size-3.5" />
              Info
            </FilterPill>
          </div>
        </div>
      </div>
    </div>
  );
}
