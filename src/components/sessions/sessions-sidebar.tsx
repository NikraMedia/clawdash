"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { unwrapSessions } from "@/lib/gateway/unwrap";
import { getSessionTitle } from "@/lib/session-utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

export function SessionsSidebar() {
  const trpc = useTRPC();
  const params = useParams();
  const activeKey = params.key
    ? decodeURIComponent(params.key as string)
    : null;

  const { data } = useQuery({
    ...trpc.sessions.list.queryOptions({
      limit: 50,
      includeDerivedTitles: true,
      includeLastMessage: true,
    }),
    refetchInterval: 10_000,
  });

  const sessions = unwrapSessions(data);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-zinc-800/60">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Sessions
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.map((s) => {
          const isActive = s.key === activeKey;
          const title = getSessionTitle(s);
          return (
            <Link
              key={s.key}
              href={`/sessions/${encodeURIComponent(s.key)}`}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-xs border-b border-zinc-800/30 transition-colors hover:bg-zinc-800/50",
                isActive
                  ? "bg-zinc-800/70 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span className="truncate">{title}</span>
            </Link>
          );
        })}
        {sessions.length === 0 && (
          <div className="p-4 text-center text-[11px] text-zinc-600">
            No sessions
          </div>
        )}
      </div>
    </div>
  );
}
