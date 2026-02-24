"use client";

import { useMemo } from "react";
import { useTRPC } from "@/lib/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGatewayHealth } from "@/hooks/use-gateway-health";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Play, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { scheduleToHuman, scheduleToRaw } from "@/lib/cron-utils";
import { formatRelativeTime, formatFutureTime, formatDuration } from "@/lib/format";
import type { CronJob } from "@/types/gateway";
import Link from "next/link";

interface StatusGridProps {
  jobs: CronJob[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}

function StatusDot({ status }: { status?: string | null }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full shrink-0 shadow-sm transition-colors duration-300",
        status === "ok" && "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
        status === "error" && "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]",
        status === "timeout" && "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
        !status && "bg-zinc-600 shadow-[0_0_8px_rgba(82,82,91,0.5)]"
      )}
    />
  );
}

export function StatusGrid({ jobs, selectedJobId, onSelectJob }: StatusGridProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { isOffline, hasMethod } = useGatewayHealth();
  const canToggle = !isOffline && hasMethod("cron.update");
  const canRun = !isOffline && hasMethod("cron.run");

  const toggleMutation = useMutation(
    trpc.cron.toggle.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cron.list.queryKey() });
      },
      onError: (err) => {
        console.error("[claw-dash] Toggle failed:", err.message);
        setTimeout(() => toggleMutation.reset(), 5000);
      },
    })
  );

  const runMutation = useMutation(
    trpc.cron.run.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cron.list.queryKey() });
        setTimeout(() => runMutation.reset(), 3000);
      },
      onError: (err) => {
        console.error("[claw-dash] Run failed:", err.message);
        setTimeout(() => runMutation.reset(), 5000);
      },
    })
  );

  // Sort: errors first, then enabled before disabled, then by name
  const sorted = useMemo(
    () =>
      [...jobs].sort((a, b) => {
        const aErrors = a.state.consecutiveErrors ?? 0;
        const bErrors = b.state.consecutiveErrors ?? 0;
        if (aErrors > 0 && bErrors === 0) return -1;
        if (bErrors > 0 && aErrors === 0) return 1;
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [jobs]
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sorted.map((job) => {
        const hasErrors = (job.state.consecutiveErrors ?? 0) > 0;
        const isSelected = selectedJobId === job.id;
        const humanSchedule = scheduleToHuman(job.schedule);
        const rawSchedule = scheduleToRaw(job.schedule);
        const tz =
          job.schedule.kind === "cron"
            ? (job.schedule.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
            : null;

        const isRunPending =
          runMutation.isPending && runMutation.variables?.id === job.id;
        const isRunSuccess =
          runMutation.isSuccess && runMutation.variables?.id === job.id;
        const isRunError =
          runMutation.isError && runMutation.variables?.id === job.id;
        const isTogglePending =
          toggleMutation.isPending && toggleMutation.variables?.id === job.id;
        const isToggleError =
          toggleMutation.isError && toggleMutation.variables?.id === job.id;

        // Optimistic enabled state
        const displayEnabled = isTogglePending
          ? toggleMutation.variables?.enabled ?? job.enabled
          : job.enabled;

        return (
          <Card
            key={job.id}
            className={cn(
              "group relative overflow-hidden bg-glass cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20",
              isSelected && "ring-2 ring-indigo-500/50 border-indigo-500/30",
              hasErrors &&
                "border-l-4 border-l-red-500 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]"
            )}
            onClick={() => onSelectJob(job.id)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <CardContent className="flex flex-col gap-3 p-4">
              {/* Header row: name + status dot + enabled badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <StatusDot status={job.state.lastStatus} />
                  <span className="truncate text-sm font-semibold tracking-tight text-zinc-100">
                    {job.name}
                  </span>
                </div>
                <Badge
                  className={cn(
                    "text-[10px] shrink-0 font-bold tracking-wider uppercase",
                    displayEnabled
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                      : "bg-zinc-800/80 text-zinc-500 border-zinc-700 shadow-none"
                  )}
                >
                  {displayEnabled ? "Active" : "Paused"}
                </Badge>
              </div>

              {/* Agent (clickable) + human-readable schedule */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <Link
                    href={`/sessions?agent=${encodeURIComponent(job.agentId)}`}
                    className="truncate max-w-[120px] font-medium text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title={`View sessions for ${job.agentId}`}
                  >
                    {job.agentId}
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-200 truncate">
                    {humanSchedule}
                  </span>
                  {humanSchedule !== rawSchedule && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 border border-zinc-800/60 shadow-inner shrink-0 truncate max-w-[100px] cursor-help">
                          {rawSchedule}
                        </code>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="bg-zinc-800 border-zinc-700 text-zinc-200 text-xs"
                      >
                        Raw cron expression
                        {tz && (
                          <span className="block text-[10px] text-zinc-400 mt-0.5">
                            Timezone: {tz}
                          </span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mt-1 rounded-lg bg-zinc-950/40 p-2.5 border border-zinc-800/40 w-full">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-0.5">
                    Last
                  </span>
                  <p className="text-xs font-medium text-zinc-300 truncate">
                    {formatRelativeTime(job.state.lastRunAtMs)}
                  </p>
                </div>
                <div className="flex flex-col border-l border-zinc-800/60 pl-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-0.5">
                    Dur
                  </span>
                  <p className="text-xs font-medium text-zinc-300 truncate">
                    {formatDuration(job.state.lastDurationMs)}
                  </p>
                </div>
                <div className="flex flex-col border-l border-zinc-800/60 pl-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-0.5">
                    Next
                  </span>
                  <p className="text-xs font-medium text-zinc-300 truncate">
                    {formatFutureTime(job.state.nextRunAtMs)}
                  </p>
                </div>
              </div>

              {/* Error info */}
              {hasErrors && (
                <div className="flex items-center gap-2 -mt-1">
                  <Badge
                    variant="outline"
                    className="w-fit bg-red-500/10 text-red-400 font-medium border-red-500/30 text-[10px] py-0 shadow-sm"
                  >
                    {job.state.consecutiveErrors} consecutive error
                    {(job.state.consecutiveErrors ?? 0) > 1 ? "s" : ""}
                  </Badge>
                  {job.state.lastError && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-red-400/60 truncate max-w-[120px] cursor-help">
                          {job.state.lastError}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="bg-zinc-900 border-zinc-700 text-red-300 text-xs max-w-[300px]"
                      >
                        {job.state.lastError}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}

              {/* Mutation error feedback */}
              {(isToggleError || isRunError) && (
                <div className="flex items-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] text-red-400">
                  <XCircle className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {isToggleError ? "Toggle failed" : "Run failed"} — try again
                  </span>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-3 pt-2 mt-auto border-t border-zinc-800/40">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center"
                    >
                      <Switch
                        size="sm"
                        checked={displayEnabled}
                        disabled={!canToggle || isTogglePending}
                        aria-label={
                          displayEnabled
                            ? `Disable ${job.name}`
                            : `Enable ${job.name}`
                        }
                        onCheckedChange={(checked) => {
                          if (!canToggle) return;
                          toggleMutation.mutate({
                            id: job.id,
                            enabled: checked,
                          });
                        }}
                        className={cn(
                          displayEnabled &&
                            "data-[state=checked]:bg-emerald-500"
                        )}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-zinc-800 border-zinc-700 text-zinc-200 text-xs"
                  >
                    {displayEnabled ? "Disable" : "Enable"} this job
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      aria-label={`Run ${job.name} now`}
                      className={cn(
                        "ml-auto transition-all duration-200 shadow-sm h-8 px-4 text-xs font-semibold",
                        isRunSuccess
                          ? "bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                          : isRunError
                            ? "bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400"
                            : "bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300"
                      )}
                      disabled={isRunPending || !canRun}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canRun) return;
                        runMutation.mutate({ id: job.id, mode: "force" });
                      }}
                    >
                      {isRunSuccess ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1.5" />
                          Triggered
                        </>
                      ) : isRunPending ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                          Running
                        </>
                      ) : isRunError ? (
                        <>
                          <XCircle className="h-3 w-3 mr-1.5" />
                          Failed
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1.5" />
                          Run Now
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-zinc-800 border-zinc-700 text-zinc-200 text-xs"
                  >
                    Force-run this job immediately
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
