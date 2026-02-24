"use client";

import { useMemo, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Box,
  Radio,
  Settings2,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTRPC } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { useGatewayHealth } from "@/hooks/use-gateway-health";
import { ConfigViewer } from "@/components/system/config-viewer";
import { SkillsList } from "@/components/system/skills-list";
import { ModelsList } from "@/components/system/models-list";
import { ChannelsStatus } from "@/components/system/channels-status";
import { ExecApprovals } from "@/components/system/exec-approvals";
import { GatewayDiagnostics } from "@/components/system/gateway-diagnostics";
import {
  countDisconnectedChannels,
  countPendingApprovals,
  normalizeChannelsData,
} from "@/components/system/system-data";

type TabTone = "default" | "attention" | "critical";

interface TabConfig {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
  tone?: TabTone;
  pulse?: boolean;
}

function TabIndicator({
  value,
  tone = "default",
  pulse = false,
}: {
  value: number;
  tone?: TabTone;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 py-0 text-[10px] font-semibold tabular-nums",
        tone === "critical" &&
          "border-red-500/30 bg-red-500/15 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]",
        tone === "attention" &&
          "border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
        tone === "default" && "border-zinc-700 bg-zinc-800/50 text-zinc-400"
      )}
    >
      {pulse && (
        <span className="mr-1.5 relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-current animate-ping opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {value}
    </span>
  );
}

export default function SystemPage() {
  const trpc = useTRPC();
  const { health, isOffline, hasMethod } = useGatewayHealth();

  const { data: channelsData } = useQuery({
    ...trpc.system.channels.queryOptions(),
    refetchInterval: 5000,
  });
  const { data: approvalsData } = useQuery({
    ...trpc.system.execApprovals.queryOptions(),
    refetchInterval: 5000,
  });

  const channelCount = useMemo(
    () => normalizeChannelsData(channelsData).length,
    [channelsData]
  );
  const disconnectedChannels = useMemo(
    () => countDisconnectedChannels(channelsData),
    [channelsData]
  );
  const pendingApprovals = useMemo(
    () => countPendingApprovals(approvalsData),
    [approvalsData]
  );

  const connectedChannels = Math.max(0, channelCount - disconnectedChannels);
  const diagnosticsIssues =
    Number(isOffline) +
    Number(!hasMethod("config.patch")) +
    Number(!hasMethod("exec.approvals.resolve"));

  const tabs: TabConfig[] = useMemo(
    () => [
      { value: "config", label: "Config", icon: Settings2 },
      { value: "skills", label: "Skills", icon: Wrench },
      { value: "models", label: "Models", icon: Box },
      {
        value: "channels",
        label: "Channels",
        icon: Radio,
        badge: disconnectedChannels > 0 ? disconnectedChannels : undefined,
        tone: disconnectedChannels > 0 ? "critical" : "default",
        pulse: disconnectedChannels > 0,
      },
      {
        value: "approvals",
        label: "Approvals",
        icon: ShieldAlert,
        badge: pendingApprovals > 0 ? pendingApprovals : undefined,
        tone: pendingApprovals > 0 ? "attention" : "default",
        pulse: pendingApprovals > 0,
      },
      {
        value: "diagnostics",
        label: "Diagnostics",
        icon: Activity,
        badge: diagnosticsIssues > 0 ? diagnosticsIssues : undefined,
        tone: diagnosticsIssues > 0 ? "critical" : "default",
      },
    ],
    [disconnectedChannels, pendingApprovals, diagnosticsIssues]
  );

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
          <h1 className="text-lg font-semibold text-zinc-50">System</h1>
          <p className="text-sm text-zinc-500">
            Settings, diagnostics, and system configuration
          </p>
        </div>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-4 shadow-md backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Gateway Status
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="relative flex h-2.5 w-2.5"
                aria-label={isOffline ? "Gateway disconnected" : "Gateway connected"}
                role="status"
              >
                {!isOffline && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-2.5 w-2.5 rounded-full",
                    isOffline ? "bg-red-500" : "bg-emerald-500"
                  )}
                />
              </span>
              <span className="text-sm font-medium text-zinc-100">
                {isOffline ? "Offline" : "Connected"}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {health?.server?.version
                ? `Version ${health.server.version}`
                : "No server version reported"}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-4 shadow-md backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Approval Queue
            </p>
            <p
              className={cn(
                "mt-2 text-2xl font-semibold tabular-nums",
                pendingApprovals > 0 ? "text-amber-400" : "text-zinc-200"
              )}
            >
              {pendingApprovals}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {pendingApprovals > 0
                ? "Requests require operator review"
                : "No pending execution approvals"}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-4 shadow-md backdrop-blur-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Channel Health
            </p>
            <div className="mt-2 flex items-baseline gap-2 text-sm">
              <span className="text-zinc-100 font-semibold tabular-nums">
                {connectedChannels}
              </span>
              <span className="text-zinc-500">connected</span>
              <span className="text-zinc-700">/</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  disconnectedChannels > 0 ? "text-red-400" : "text-zinc-400"
                )}
              >
                {disconnectedChannels}
              </span>
              <span className="text-zinc-500">disconnected</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {channelCount > 0
                ? `${channelCount} total channel${channelCount === 1 ? "" : "s"}`
                : "No channels reported"}
            </p>
          </div>
        </section>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
          <Tabs defaultValue="config">
            <TabsList className="bg-zinc-900 border border-zinc-800 h-auto flex-wrap">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-50 data-[state=inactive]:text-zinc-500 px-3 py-2"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <TabIndicator
                      value={tab.badge}
                      tone={tab.tone}
                      pulse={tab.pulse}
                    />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="config">
              <ConfigViewer />
            </TabsContent>

            <TabsContent value="skills">
              <SkillsList />
            </TabsContent>

            <TabsContent value="models">
              <ModelsList />
            </TabsContent>

            <TabsContent value="channels">
              <ChannelsStatus />
            </TabsContent>

            <TabsContent value="approvals">
              <ExecApprovals />
            </TabsContent>

            <TabsContent value="diagnostics">
              <GatewayDiagnostics />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
