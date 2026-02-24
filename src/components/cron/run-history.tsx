"use client";

import { useMemo } from "react";
import { useTRPC } from "@/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QueryError } from "@/components/ui/query-error";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { X, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { formatTimestamp, formatDuration } from "@/lib/format";

interface RunHistoryProps {
  jobId: string;
  onClose: () => void;
}

const STATUS_CONFIG = {
  ok: {
    icon: CheckCircle2,
    label: "Success",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    rail: "bg-emerald-500",
    row: "hover:bg-emerald-500/[0.03]",
  },
  error: {
    icon: XCircle,
    label: "Error",
    badge: "bg-red-500/15 text-red-400 border-red-500/25",
    rail: "bg-red-500",
    row: "hover:bg-red-500/[0.03]",
  },
  timeout: {
    icon: AlertTriangle,
    label: "Timeout",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    rail: "bg-amber-500",
    row: "hover:bg-amber-500/[0.03]",
  },
} as const;

function getStatusConfig(status?: string) {
  if (status && status in STATUS_CONFIG) {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  }
  return {
    icon: Clock,
    label: status ?? "unknown",
    badge: "bg-zinc-700/40 text-zinc-500 border-zinc-700",
    rail: "bg-zinc-600",
    row: "hover:bg-zinc-800/30",
  };
}

export function RunHistory({ jobId, onClose }: RunHistoryProps) {
  const trpc = useTRPC();

  const {
    data: runs,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery(trpc.cron.runs.queryOptions({ id: jobId, limit: 50 }));

  const { errorCount, successRate } = useMemo(() => {
    const sc = runs?.filter((r) => r.status === "ok").length ?? 0;
    const ec = runs?.filter((r) => r.status === "error" || r.status === "timeout").length ?? 0;
    const rate = runs && runs.length > 0 ? Math.round((sc / runs.length) * 100) : null;
    return { errorCount: ec, successRate: rate };
  }, [runs]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-zinc-300">Run History</h3>
          {runs && runs.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500">
                {runs.length} run{runs.length !== 1 ? "s" : ""}
              </span>
              {successRate !== null && (
                <Badge
                  className={cn(
                    "text-[10px] font-bold",
                    successRate >= 90
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : successRate >= 70
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}
                >
                  {successRate}% success
                </Badge>
              )}
              {errorCount > 0 && (
                <span className="text-[10px] text-red-400/70">
                  {errorCount} failed
                </span>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-zinc-500 hover:text-zinc-300"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4">
          <QueryError
            error={error}
            label="run history"
            onRetry={() => refetch()}
          />
        </div>
      )}

      {/* Table */}
      {!isError && (
        <ScrollArea className="max-h-[400px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="w-1" />
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">
                  Timestamp
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">
                  Status
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-zinc-500">
                  Duration
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">
                  Details
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">
                  Session
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4 animate-pulse" />
                      Loading run history...
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && (!runs || runs.length === 0) && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No runs recorded yet
                  </td>
                </tr>
              )}
              {runs?.map((run, i) => {
                const config = getStatusConfig(run.status);
                const Icon = config.icon;

                return (
                  <tr
                    key={`${run.ts}-${i}`}
                    className={cn(
                      "border-b border-zinc-800/50 transition-colors",
                      config.row
                    )}
                  >
                    {/* Color rail */}
                    <td className="w-1 p-0">
                      <div
                        className={cn("w-1 h-full min-h-[40px]", config.rail)}
                      />
                    </td>

                    <td className="px-4 py-2 text-zinc-300 tabular-nums text-xs whitespace-nowrap">
                      {formatTimestamp(run.ts)}
                    </td>

                    <td className="px-4 py-2">
                      <Badge className={cn("text-[10px] gap-1", config.badge)}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </td>

                    <td className="px-4 py-2 text-right text-zinc-400 tabular-nums text-xs">
                      {formatDuration(run.durationMs)}
                    </td>

                    <td className="px-4 py-2 text-xs max-w-[200px]">
                      {run.error ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-red-400 truncate block cursor-help">
                              {run.error}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="bg-zinc-900 border-zinc-700 text-red-300 text-xs max-w-[400px] break-words"
                          >
                            {run.error}
                          </TooltipContent>
                        </Tooltip>
                      ) : run.summary ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-zinc-400 truncate block cursor-help">
                              {run.summary}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="bg-zinc-900 border-zinc-700 text-zinc-200 text-xs max-w-[400px] break-words"
                          >
                            {run.summary}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-zinc-600">{"\u2014"}</span>
                      )}
                    </td>

                    <td className="px-4 py-2 text-xs">
                      {run.sessionKey ? (
                        <Link
                          href={`/sessions/${encodeURIComponent(run.sessionKey)}`}
                          className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                        >
                          {run.sessionKey.length > 16
                            ? `${run.sessionKey.slice(0, 16)}...`
                            : run.sessionKey}
                        </Link>
                      ) : (
                        <span className="text-zinc-600">{"\u2014"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  );
}
