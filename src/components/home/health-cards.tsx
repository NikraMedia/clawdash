"use client";

import Link from "next/link";
import {
  Activity,
  Bot,
  Cable,
  ChevronRight,
  Clock3,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryError } from "@/components/ui/query-error";
import { formatUptime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface HealthCardsData {
  connected: boolean;
  uptimeMs: number | null;
  version: string | null;
  methodCount: number;
  eventCount: number;
  agentCount: number;
  activeSessionCount: number;
  connectedChannels: number;
  totalChannels: number;
  enabledCronJobs: number;
  unhealthyCronJobs: number;
  alertCount: number;
}

interface HealthCardsProps {
  data: HealthCardsData | null;
  isLoading: boolean;
  error: { message?: string } | null;
}

type Tone = "zinc" | "emerald" | "amber" | "red" | "blue";

const toneStyles: Record<Tone, { border: string; icon: string; chip: string }> = {
  zinc: {
    border: "border-zinc-800/70 hover:border-zinc-700",
    icon: "text-zinc-400",
    chip: "bg-zinc-800/70 text-zinc-200",
  },
  emerald: {
    border: "border-emerald-500/30 hover:border-emerald-400/50",
    icon: "text-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-300",
  },
  amber: {
    border: "border-amber-500/30 hover:border-amber-400/50",
    icon: "text-amber-400",
    chip: "bg-amber-500/15 text-amber-300",
  },
  red: {
    border: "border-red-500/30 hover:border-red-400/50",
    icon: "text-red-400",
    chip: "bg-red-500/15 text-red-300",
  },
  blue: {
    border: "border-cyan-500/30 hover:border-cyan-400/50",
    icon: "text-cyan-400",
    chip: "bg-cyan-500/15 text-cyan-300",
  },
};

function SkeletonCard() {
  return (
    <Card className="h-full border-zinc-800/70 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <div className="h-3 w-24 animate-pulse rounded bg-zinc-800/70" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-6 w-20 animate-pulse rounded bg-zinc-800/70" />
        <div className="h-3 w-full animate-pulse rounded bg-zinc-800/50" />
      </CardContent>
    </Card>
  );
}

export function HealthCards({ data, isLoading, error }: HealthCardsProps) {
  if (error && !data) {
    return <QueryError error={error} label="home health metrics" />;
  }

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (!data) {
    return <QueryError error={{ message: "No health data available" }} label="home health metrics" />;
  }

  const cards = [
    {
      key: "gateway",
      title: "Gateway",
      value: data.connected ? "Online" : "Offline",
      detail: data.connected
        ? `${data.version ?? "Unknown version"} · ${data.uptimeMs != null ? formatUptime(data.uptimeMs) : "No uptime"}`
        : "Connection unavailable",
      subDetail: `${data.methodCount} methods · ${data.eventCount} events`,
      href: "/system",
      icon: Cable,
      tone: data.connected ? "emerald" : "red",
    },
    {
      key: "agents",
      title: "Agents",
      value: `${data.agentCount}`,
      detail:
        data.totalChannels > 0
          ? `${data.connectedChannels}/${data.totalChannels} channels connected`
          : "No channels configured",
      subDetail: "Open system controls",
      href: "/system",
      icon: Bot,
      tone: data.agentCount > 0 ? "blue" : "zinc",
    },
    {
      key: "sessions",
      title: "Active Sessions",
      value: `${data.activeSessionCount}`,
      detail:
        data.activeSessionCount > 0
          ? "Sessions active in the last 60 minutes"
          : "No recent sessions",
      subDetail: "Open session workspace",
      href: "/sessions",
      icon: Activity,
      tone: data.activeSessionCount > 0 ? "emerald" : "zinc",
    },
    {
      key: "cron",
      title: "Cron Health",
      value: `${data.enabledCronJobs} enabled`,
      detail:
        data.unhealthyCronJobs > 0
          ? `${data.unhealthyCronJobs} failing job${data.unhealthyCronJobs === 1 ? "" : "s"}`
          : "No failing jobs",
      subDetail: "Review schedules and runs",
      href: "/cron",
      icon: Clock3,
      tone: data.unhealthyCronJobs > 0 ? "amber" : "emerald",
    },
    {
      key: "alerts",
      title: "Alert Pressure",
      value: `${data.alertCount}`,
      detail:
        data.alertCount > 0
          ? "Warnings/errors detected in activity stream"
          : "No active warnings or errors",
      subDetail: "Inspect activity feed",
      href: data.alertCount > 0 ? "/activity?severity=error" : "/activity",
      icon: ShieldAlert,
      tone: data.alertCount > 0 ? "red" : "emerald",
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const style = toneStyles[card.tone];

        return (
          <Link key={card.key} href={card.href} className="group block h-full">
            <Card
              className={cn(
                "h-full bg-zinc-900/40 transition-all duration-200 hover:-translate-y-0.5",
                style.border
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-xs font-medium text-zinc-400">
                  {card.title}
                  <Icon className={cn("h-4 w-4", style.icon)} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-semibold text-zinc-100">{card.value}</p>
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] uppercase", style.chip)}>
                    Live
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-zinc-400">{card.detail}</p>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{card.subDetail}</span>
                  <span className="inline-flex items-center gap-1 text-zinc-400 transition-colors group-hover:text-zinc-200">
                    Open
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
