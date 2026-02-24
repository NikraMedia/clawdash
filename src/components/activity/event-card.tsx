"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, CircleDot, Filter, type LucideIcon } from "lucide-react";
import { CodeBlock } from "@/components/ui/code-block";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import type { ActivityAgentOption } from "./filters";

interface EventCardProps {
  event: {
    id: number;
    event: string;
    payload?: unknown;
    timestamp: number;
    severity: "info" | "warning" | "error";
    agentId?: string;
  };
  agent?: ActivityAgentOption;
  isLast?: boolean;
  isFresh?: boolean;
  isSeverityActive?: boolean;
  onEventTypeClick?: (eventType: string) => void;
  onSeverityClick?: (severity: Severity) => void;
}

type Severity = EventCardProps["event"]["severity"];

const severityConfig: Record<
  Severity,
  {
    label: string;
    icon: LucideIcon;
    badgeClass: string;
    dotClass: string;
    dotGlowClass: string;
    cardAccentClass: string;
  }
> = {
  error: {
    label: "Error",
    icon: AlertCircle,
    badgeClass: "border-red-500/30 bg-red-500/15 text-red-300",
    dotClass: "bg-red-500",
    dotGlowClass: "shadow-[0_0_10px_rgba(239,68,68,0.6)]",
    cardAccentClass: "border-l-red-500/45",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    badgeClass: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    dotClass: "bg-amber-500",
    dotGlowClass: "shadow-[0_0_10px_rgba(245,158,11,0.6)]",
    cardAccentClass: "border-l-amber-500/45",
  },
  info: {
    label: "Info",
    icon: CircleDot,
    badgeClass: "border-sky-500/30 bg-sky-500/15 text-sky-300",
    dotClass: "bg-sky-400",
    dotGlowClass: "shadow-[0_0_8px_rgba(56,189,248,0.55)]",
    cardAccentClass: "border-l-sky-500/45",
  },
};

function hasPayload(payload: unknown): boolean {
  return payload != null;
}

function serializePayload(payload: unknown): string {
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export function EventCard({
  event,
  agent,
  isLast = false,
  isFresh = false,
  isSeverityActive = false,
  onEventTypeClick,
  onSeverityClick,
}: EventCardProps) {
  const showPayload = hasPayload(event.payload);
  const config = severityConfig[event.severity];
  const SeverityIcon = config.icon;
  const payloadValue = showPayload ? serializePayload(event.payload) : "";
  const agentLabel = agent?.name ?? event.agentId;

  return (
    <article
      className="relative pl-8 pb-3"
      style={{ contentVisibility: "auto", containIntrinsicSize: "180px" }}
    >
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-zinc-800" />
      )}
      <div
        className={cn(
          "absolute left-2 top-3 z-10 h-2.5 w-2.5 rounded-full",
          config.dotClass,
          config.dotGlowClass
        )}
      />

      <div
        className={cn(
          "group/card relative flex flex-col gap-1.5 overflow-hidden rounded-xl border border-zinc-800/60 border-l-2 bg-glass shadow-md transition-all duration-300 hover:border-zinc-700/80 hover:bg-zinc-800/60",
          config.cardAccentClass,
          isFresh && "ring-1 ring-emerald-500/35"
        )}
      >
        <div className="px-4 py-2.5">
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <SeverityIcon className="mt-0.5 size-4 shrink-0 text-zinc-400" />
              <span className="truncate font-mono text-sm font-semibold tracking-tight text-zinc-100">
                {event.event}
              </span>
            </div>

            <button
              type="button"
              aria-pressed={isSeverityActive}
              onClick={() => onSeverityClick?.(event.severity)}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
                config.badgeClass,
                "hover:brightness-[1.1]",
                isSeverityActive && "ring-1 ring-offset-1 ring-offset-zinc-950"
              )}
            >
              {config.label}
            </button>

            <button
              type="button"
              onClick={() => onEventTypeClick?.(event.event)}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-700/70 bg-zinc-950/70 px-2 py-0.5 text-[10px] font-medium text-zinc-300 transition-colors hover:border-zinc-500/80 hover:bg-zinc-900"
            >
              <Filter className="size-3" />
              {event.event}
            </button>

            {event.agentId && agentLabel && (
              <Link
                href={`/sessions?agent=${encodeURIComponent(event.agentId)}`}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-700/80 bg-zinc-900/60 px-2 py-0.5 text-[10px] font-medium text-zinc-300 transition-colors hover:border-zinc-500/80 hover:bg-zinc-800/70 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
              >
                {agent?.emoji ? (
                  <span className="text-xs leading-none">{agent.emoji}</span>
                ) : null}
                <span className="max-w-[180px] truncate">{agentLabel}</span>
              </Link>
            )}

            <span
              title={formatTimestamp(event.timestamp)}
              className="ml-auto shrink-0 text-xs font-medium text-zinc-500 transition-colors group-hover/card:text-zinc-400"
            >
              {formatRelativeTime(event.timestamp)}
            </span>
          </div>
        </div>

        {showPayload && (
          <Accordion type="single" collapsible className="w-full px-5 pb-2">
            <AccordionItem value={`payload-${event.id}`} className="border-none">
              <AccordionTrigger className="w-fit gap-1.5 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300 hover:no-underline">
                View payload
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-3">
                <div className="overflow-hidden rounded-lg border border-zinc-800/80 shadow-inner">
                  <CodeBlock
                    language="json"
                    value={payloadValue}
                    className="m-0 rounded-none border-0 bg-zinc-950/80 text-xs shadow-none"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>
    </article>
  );
}
