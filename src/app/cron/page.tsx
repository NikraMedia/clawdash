"use client";

import { Suspense, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTRPC } from "@/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { StatusGrid } from "@/components/cron/status-grid";
import { RunHistory } from "@/components/cron/run-history";
import { TimelineView } from "@/components/cron/timeline-view";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonLines } from "@/components/ui/skeleton-rows";
import { Badge } from "@/components/ui/badge";
import { unwrapCronJobs } from "@/lib/gateway/unwrap";
import { formatFutureTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Timer,
  CalendarClock,
} from "lucide-react";
import type { CronJob } from "@/types/gateway";

function CronSummary({ jobs }: { jobs: CronJob[] }) {
  const stats = useMemo(() => {
    const enabled = jobs.filter((j) => j.enabled).length;
    const disabled = jobs.length - enabled;
    const erroring = jobs.filter(
      (j) => (j.state.consecutiveErrors ?? 0) > 0
    ).length;
    const healthy = jobs.filter(
      (j) => j.enabled && j.state.lastStatus === "ok"
    ).length;

    // Find next upcoming run across all enabled jobs
    const nextRunMs = jobs
      .filter((j) => j.enabled && j.state.nextRunAtMs)
      .map((j) => j.state.nextRunAtMs!)
      .sort((a, b) => a - b)[0];

    return { enabled, disabled, erroring, healthy, nextRunMs };
  }, [jobs]);

  const summaryItems = [
    {
      label: "Total",
      value: jobs.length,
      icon: CalendarClock,
      color: "text-zinc-300",
    },
    {
      label: "Active",
      value: stats.enabled,
      icon: CheckCircle2,
      color: "text-emerald-400",
    },
    {
      label: "Paused",
      value: stats.disabled,
      icon: Pause,
      color: "text-zinc-500",
    },
    {
      label: "Erroring",
      value: stats.erroring,
      icon: XCircle,
      color: stats.erroring > 0 ? "text-red-400" : "text-zinc-500",
    },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/50 p-5 ring-1 ring-inset ring-white/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <CalendarClock className="h-5 w-5 text-indigo-400" />
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
              Scheduling
            </h1>
            {stats.erroring > 0 && (
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] font-bold">
                {stats.erroring} failing
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm text-zinc-400">
            {jobs.length === 0
              ? "No scheduled automations configured."
              : stats.erroring > 0
                ? `${stats.erroring} job${stats.erroring > 1 ? "s" : ""} failing. Review errors and re-run.`
                : `${stats.enabled} active job${stats.enabled !== 1 ? "s" : ""} running across agents.`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-5">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-3 py-2"
            >
              <div className="flex items-center gap-1.5 text-zinc-500">
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </div>
              <p className={cn("mt-1 font-semibold tabular-nums", item.color)}>
                {item.value}
              </p>
            </div>
          ))}
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-3 py-2">
            <div className="flex items-center gap-1.5 text-zinc-500">
              <Timer className="h-3.5 w-3.5" />
              Next Run
            </div>
            <p className="mt-1 font-semibold text-zinc-300 tabular-nums">
              {formatFutureTime(stats.nextRunMs)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CronPageContent() {
  const searchParams = useSearchParams();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    searchParams.get("job")
  );

  const trpc = useTRPC();
  const {
    data: cronData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(trpc.cron.list.queryOptions({ includeDisabled: true }));

  const jobs = useMemo(() => unwrapCronJobs(cronData), [cronData]);
  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  const handleSelectJob = useCallback(
    (jobId: string) => {
      setSelectedJobId((prev) => (prev === jobId ? null : jobId));
    },
    []
  );

  const handleCloseHistory = useCallback(() => {
    setSelectedJobId(null);
  }, []);

  if (isError) {
    return (
      <QueryError
        error={error}
        label="cron jobs"
        onRetry={() => refetch()}
      />
    );
  }

  if (isLoading) {
    return <SkeletonLines count={8} />;
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No cron jobs configured"
        description="Scheduled automations registered with the gateway will appear here. Create a cron job in your agent configuration to get started."
        className="min-h-[400px]"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary stats */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
        <CronSummary jobs={jobs} />
      </section>

      {/* Job cards grid */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 fill-mode-both">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">Jobs</h2>
        <StatusGrid
          jobs={jobs}
          selectedJobId={selectedJobId}
          onSelectJob={handleSelectJob}
        />
      </section>

      {/* Run history — always rendered, animates in/out */}
      <section
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          selectedJobId
            ? "max-h-[600px] opacity-100"
            : "max-h-0 opacity-0"
        )}
      >
        {selectedJobId && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both">
            <h2 className="mb-3 text-sm font-medium text-zinc-400">
              Run History
              {selectedJob && (
                <span className="ml-2 text-zinc-300 font-semibold">
                  {selectedJob.name}
                </span>
              )}
            </h2>
            <RunHistory jobId={selectedJobId} onClose={handleCloseHistory} />
          </div>
        )}
      </section>

      {/* Schedule timeline */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both">
        <h2 className="mb-3 text-sm font-medium text-zinc-400">
          Schedule Timeline
        </h2>
        <TimelineView jobs={jobs} />
      </section>
    </div>
  );
}

export default function CronPage() {
  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <Suspense fallback={<SkeletonLines count={8} />}>
          <CronPageContent />
        </Suspense>
      </div>
    </div>
  );
}
