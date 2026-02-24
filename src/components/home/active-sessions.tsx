"use client";

import Link from "next/link";
import { ArrowUpRight, MessageSquareText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ActiveSessionItem {
  key: string;
  href: string;
  title: string;
  updatedAt: number | null;
  model?: string;
  agentId?: string;
  statusLabel: "active" | "idle";
}

interface ActiveSessionsProps {
  sessions: ActiveSessionItem[];
  isLoading: boolean;
  error: { message?: string } | null;
}

export function ActiveSessions({ sessions, isLoading, error }: ActiveSessionsProps) {
  const visibleSessions = sessions.slice(0, 8);

  return (
    <Card className="h-full border-zinc-800/70 bg-zinc-900/40">
      <CardHeader className="border-b border-white/5 pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-zinc-300">
          <span>Active Sessions</span>
          {sessions.length > 0 && (
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            >
              {sessions.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4">
        {error && !isLoading && (
          <QueryError error={error} label="active sessions" />
        )}

        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-800/40"
              />
            ))}
          </div>
        )}

        {!isLoading && !error && sessions.length === 0 && (
          <EmptyState
            icon={MessageSquareText}
            title="No active sessions"
            description="Start a session to begin live agent work. Active conversations will appear here."
            className="min-h-[240px]"
            action={
              <Link
                href="/sessions"
                className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
              >
                Start Session
              </Link>
            }
          />
        )}

        {!isLoading && !error && sessions.length > 0 && (
          <div className="flex flex-col gap-2">
            {visibleSessions.map((session) => (
              <Link
                key={session.key}
                href={session.href}
                aria-label={`Open session: ${session.title}`}
                className="group/session rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3 transition-all hover:border-zinc-700 hover:bg-zinc-900/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {session.title}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase",
                          session.statusLabel === "active"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-zinc-700/70 bg-zinc-800/50 text-zinc-400"
                        )}
                      >
                        {session.statusLabel}
                      </Badge>

                      {session.model && (
                        <Badge
                          variant="outline"
                          className="border-zinc-700/70 bg-zinc-800/50 text-[10px] text-zinc-300"
                        >
                          {session.model}
                        </Badge>
                      )}

                      {session.agentId && (
                        <Badge
                          variant="outline"
                          className="border-zinc-700/70 bg-zinc-800/50 text-[10px] text-zinc-300"
                        >
                          {session.agentId}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-zinc-500">
                    <span>{formatRelativeTime(session.updatedAt)}</span>
                    <span className="inline-flex items-center gap-1 text-zinc-400 transition-colors group-hover/session:text-zinc-100">
                      Open
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            {sessions.length > visibleSessions.length && (
              <Link
                href="/sessions"
                className="mt-1 text-center text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
              >
                View all sessions
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
