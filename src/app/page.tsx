"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import {
  HealthCards,
  type HealthCardsData,
} from "@/components/home/health-cards";
import {
  RecentAlerts,
  type RecentAlertItem,
} from "@/components/home/recent-alerts";
import {
  ActiveSessions,
  type ActiveSessionItem,
} from "@/components/home/active-sessions";
import { SystemGraph } from "@/components/topology/system-graph";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { unwrapCronJobs, unwrapChannels, unwrapSessions } from "@/lib/gateway/unwrap";
import { getSessionTitle } from "@/lib/session-utils";
import { Activity, Bot, Cable, Workflow } from "lucide-react";

type ActivitySeverity = "info" | "warning" | "error";

type ActivityEvent = {
  id: number;
  event: string;
  timestamp: number;
  severity: ActivitySeverity;
  agentId?: string;
};

function toDisplayError(error: unknown): { message?: string } | null {
  if (!error) return null;
  if (error instanceof Error) return { message: error.message };

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return { message };
    }
  }

  return { message: "Request failed" };
}

function buildActivityHref(event: ActivityEvent): string {
  const params = new URLSearchParams();
  params.set("severity", event.severity);
  params.set("eventType", event.event);
  if (event.agentId) {
    params.set("agentId", event.agentId);
  }
  return `/activity?${params.toString()}`;
}

export default function Home() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const trpc = useTRPC();

  const agentsQuery = useQuery(trpc.agents.list.queryOptions());
  const cronQuery = useQuery(
    trpc.cron.list.queryOptions({ includeDisabled: true })
  );
  const channelsQuery = useQuery(trpc.system.channels.queryOptions());
  const sessionsQuery = useQuery(
    trpc.sessions.list.queryOptions({
      activeMinutes: 60,
      includeDerivedTitles: true,
      includeLastMessage: true,
    })
  );
  const healthQuery = useQuery({
    ...trpc.system.health.queryOptions(),
    refetchInterval: 5000,
  });
  const activityQuery = useQuery({
    ...trpc.system.activity.queryOptions({
      showAll: false,
      limit: 80,
    }),
    refetchInterval: 10000,
  });

  const agents = agentsQuery.data?.agents ?? [];
  const cronJobs = useMemo(() => unwrapCronJobs(cronQuery.data), [cronQuery.data]);
  const sessions = useMemo(() => unwrapSessions(sessionsQuery.data), [sessionsQuery.data]);

  const channels = useMemo(() => {
    if (!channelsQuery.data) return [];
    const channelMap = unwrapChannels(channelsQuery.data);
    return Object.entries(channelMap).map(([name, val]) => ({
      name,
      connected:
        (val as { running?: boolean })?.running ??
        (val as { configured?: boolean })?.configured ??
        false,
      agentId: (val as { agentId?: string })?.agentId,
    }));
  }, [channelsQuery.data]);

  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const session of sessions) {
      const from = session.origin?.from;
      if (from) {
        counts[from] = (counts[from] ?? 0) + 1;
      }
    }
    return counts;
  }, [sessions]);

  const activeSessions = useMemo<ActiveSessionItem[]>(() => {
    return [...sessions]
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .map((session) => {
        const updatedAt = session.updatedAt ?? null;
        const statusLabel: "active" | "idle" =
          updatedAt != null && now - updatedAt < 5 * 60 * 1000
            ? "active"
            : "idle";

        return {
          key: session.key,
          href: `/sessions/${encodeURIComponent(session.key)}`,
          title: getSessionTitle(session),
          agentId: session.origin?.from,
          model: session.model,
          updatedAt,
          statusLabel,
        };
      });
  }, [sessions, now]);

  const recentAlerts = useMemo<RecentAlertItem[]>(() => {
    const severityRank = { error: 0, warning: 1 } as const;

    const events = ((activityQuery.data?.events ?? []) as ActivityEvent[])
      .filter(
        (event) => event.severity === "error" || event.severity === "warning"
      )
      .sort((a, b) => {
        const rankDiff =
          severityRank[a.severity as "error" | "warning"] -
          severityRank[b.severity as "error" | "warning"];
        if (rankDiff !== 0) return rankDiff;
        return b.timestamp - a.timestamp;
      });

    return events.map((event) => ({
      id: `${event.id}-${event.timestamp}`,
      event: event.event,
      severity: event.severity as "error" | "warning",
      timestamp: event.timestamp,
      agentId: event.agentId,
      href: buildActivityHref(event),
    }));
  }, [activityQuery.data]);

  const healthData = useMemo<HealthCardsData | null>(() => {
    const health = healthQuery.data;
    if (!health) return null;

    const connectedChannels = channels.filter((channel) => channel.connected).length;
    const enabledCronJobs = cronJobs.filter((job) => job.enabled).length;
    const unhealthyCronJobs = cronJobs.filter((job) => {
      const status = job.state?.lastStatus;
      return status === "error" || (job.state?.consecutiveErrors ?? 0) > 0;
    }).length;

    return {
      connected: health.connected,
      uptimeMs: health.snapshot?.uptimeMs ?? null,
      version: health.server?.version ?? null,
      methodCount: health.methods.length,
      eventCount: health.events.length,
      agentCount: agents.length,
      activeSessionCount: activeSessions.length,
      connectedChannels,
      totalChannels: channels.length,
      enabledCronJobs,
      unhealthyCronJobs,
      alertCount: recentAlerts.length,
    };
  }, [healthQuery.data, channels, cronJobs, agents.length, activeSessions.length, recentAlerts.length]);

  const healthLoading =
    !healthData &&
    (healthQuery.isLoading ||
      agentsQuery.isLoading ||
      cronQuery.isLoading ||
      channelsQuery.isLoading ||
      sessionsQuery.isLoading);

  const healthError =
    toDisplayError(healthQuery.error) ??
    toDisplayError(agentsQuery.error) ??
    toDisplayError(cronQuery.error) ??
    toDisplayError(channelsQuery.error) ??
    toDisplayError(sessionsQuery.error);

  const sessionsError = toDisplayError(sessionsQuery.error);
  const alertsError = toDisplayError(activityQuery.error);
  const graphError = toDisplayError(agentsQuery.error);

  const summaryText = healthLoading
    ? "Loading live telemetry from the gateway."
    : healthError
      ? "Telemetry is partially unavailable. Use quick actions to inspect details."
      : healthData?.connected
        ? "Gateway connected. Use Home as a launchpad for sessions, alerts, and automation."
        : "Gateway appears offline. Open diagnostics to restore connectivity.";

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 p-5 ring-1 ring-inset ring-white/5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {healthData?.connected ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  )}
                  <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
                    Operations Overview
                  </h1>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">{summaryText}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-4">
                <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-3 py-2 text-zinc-300">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Bot className="h-3.5 w-3.5" />
                    Sessions
                  </div>
                  <p className="mt-1 font-semibold text-zinc-100">
                    {activeSessions.length}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-3 py-2 text-zinc-300">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Activity className="h-3.5 w-3.5" />
                    Alerts
                  </div>
                  <p className="mt-1 font-semibold text-zinc-100">
                    {recentAlerts.length}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-3 py-2 text-zinc-300">
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <Cable className="h-3.5 w-3.5" />
                    Channels
                  </div>
                  <p className="mt-1 font-semibold text-zinc-100">
                    {healthData?.connectedChannels ?? 0}/
                    {healthData?.totalChannels ?? channels.length}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/sessions"
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
                >
                  Start Session
                </Link>
                <Link
                  href={recentAlerts.length > 0 ? "/activity?severity=error" : "/activity"}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                >
                  Review Activity
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
          <h2 className="mb-3 text-sm font-medium text-zinc-400">System Health</h2>
          <HealthCards
            data={healthData}
            isLoading={healthLoading}
            error={healthError}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both xl:col-span-8">
            <h2 className="mb-3 text-sm font-medium text-zinc-400">Topology</h2>
            {graphError && (
              <div className="mb-3">
                <QueryError
                  error={graphError}
                  label="agents"
                  onRetry={() => agentsQuery.refetch()}
                />
              </div>
            )}
            {agents.length > 0 ? (
              <SystemGraph
                agents={agents}
                cronJobs={cronJobs}
                channels={channels}
                sessionCounts={sessionCounts}
              />
            ) : (
              <EmptyState
                icon={Workflow}
                title="No agents configured"
                description="Add an agent to start routing sessions, cron jobs, and channel activity through the graph."
                className="min-h-[260px]"
              />
            )}
          </section>

          <div className="flex flex-col gap-6 xl:col-span-4">
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
              <RecentAlerts
                alerts={recentAlerts}
                isLoading={activityQuery.isLoading && recentAlerts.length === 0}
                error={alertsError}
              />
            </section>

            <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
              <ActiveSessions
                sessions={activeSessions}
                isLoading={sessionsQuery.isLoading && activeSessions.length === 0}
                error={sessionsError}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
