"use client";

import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface RecentAlertItem {
  id: string;
  event: string;
  severity: "error" | "warning";
  timestamp: number;
  agentId?: string;
  href: string;
}

interface RecentAlertsProps {
  alerts: RecentAlertItem[];
  isLoading: boolean;
  error: { message?: string } | null;
}

const severityStyles = {
  error: {
    icon: AlertCircle,
    iconColor: "text-red-400",
    badge: "border-red-500/30 bg-red-500/15 text-red-300",
    row: "border-red-500/30 bg-red-500/5 hover:bg-red-500/10",
    rail: "before:bg-red-500/70",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    row: "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
    rail: "before:bg-amber-500/70",
  },
} as const;

export function RecentAlerts({ alerts, isLoading, error }: RecentAlertsProps) {
  const visibleAlerts = alerts.slice(0, 6);

  return (
    <Card className="h-full border-zinc-800/70 bg-zinc-900/40">
      <CardHeader className="border-b border-white/5 pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-zinc-300">
          <span>Recent Alerts</span>
          {alerts.length > 0 ? (
            <Badge
              variant="outline"
              className="border-red-500/30 bg-red-500/10 text-red-300"
            >
              {alerts.length}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            >
              Clear
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4">
        {error && !isLoading && <QueryError error={error} label="recent alerts" />}

        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-800/40"
              />
            ))}
          </div>
        )}

        {!isLoading && !error && alerts.length === 0 && (
          <EmptyState
            icon={BellRing}
            title="No recent warnings or errors"
            description="The activity stream is currently healthy. Alerts will appear here when action is needed."
            className="min-h-[240px]"
            action={
              <Link
                href="/activity"
                className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
              >
                Open Activity
              </Link>
            }
          />
        )}

        {!isLoading && !error && alerts.length > 0 && (
          <div className="flex flex-col gap-2">
            {visibleAlerts.map((alert) => {
              const style = severityStyles[alert.severity];
              const Icon = style.icon;

              return (
                <Link
                  key={alert.id}
                  href={alert.href}
                  className={cn(
                    "group/alert relative rounded-xl border p-3 transition-colors before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[2px] before:rounded-full",
                    style.row,
                    style.rail
                  )}
                >
                  <div className="flex items-start justify-between gap-3 pl-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4 shrink-0", style.iconColor)} />
                        <p className="truncate text-sm font-medium text-zinc-100">
                          {alert.event}
                        </p>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] uppercase", style.badge)}
                        >
                          {alert.severity}
                        </Badge>

                        {alert.agentId && (
                          <Badge
                            variant="outline"
                            className="border-zinc-700/70 bg-zinc-800/50 text-[10px] text-zinc-300"
                          >
                            {alert.agentId}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-zinc-500">
                      <span>{formatRelativeTime(alert.timestamp)}</span>
                      <span className="inline-flex items-center gap-1 text-zinc-400 transition-colors group-hover/alert:text-zinc-100">
                        View
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}

            <Link
              href="/activity"
              className="mt-1 text-center text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
            >
              View full activity stream
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
