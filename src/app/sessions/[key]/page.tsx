"use client";

import { use, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { SessionWorkspace } from "@/components/sessions/session-workspace";
import type { TranscriptMessage } from "@/components/sessions/session-workspace";
import { QueryError } from "@/components/ui/query-error";
import Link from "next/link";
import { SessionsSidebar } from "@/components/sessions/sessions-sidebar";
import { unwrapSessions, unwrapMessages } from "@/lib/gateway/unwrap";
import {
  useSessionStream,
  SessionStreamContext,
} from "@/hooks/use-session-stream";

export default function SessionWorkspacePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const sessionKey = decodeURIComponent(key);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { state: streamState, dispatch: streamDispatch } =
    useSessionStream(sessionKey);
  const streamCtx = useMemo(
    () => ({ state: streamState, dispatch: streamDispatch }),
    [streamState, streamDispatch]
  );

  // Load session metadata from sessions.list (includes label, derivedTitle)
  const { data: listData } = useQuery({
    ...trpc.sessions.list.queryOptions({
      includeDerivedTitles: true,
      includeLastMessage: true,
    }),
    // Keep polling so newly-created sessions appear in the sidebar and
    // metadata (token counts, model, etc.) refresh after responses complete
    refetchInterval: 10_000,
  });

  // Load transcript — poll if SSE is not connected (fallback), otherwise rely on SSE events
  const {
    data: historyData,
    isLoading: historyLoading,
    isError: historyError,
    error: historyErr,
    refetch: refetchHistory,
  } = useQuery({
    ...trpc.sessions.history.queryOptions({ sessionKey, limit: 500 }),
    refetchInterval: (query) => {
      const msgs = unwrapMessages(query.state.data);
      // Poll aggressively until first message arrives, then rely on SSE
      if (streamState.connected && msgs.length === 0) return 1000;
      if (streamState.connected) return false;
      return 5000;
    },
  });

  // When a stream completes (final/error/aborted), refetch both history and session list
  // so config panel and sidebar update with new token counts and derived titles
  useEffect(() => {
    if (streamState.lastCompletedSeq > 0) {
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: trpc.sessions.list.queryKey() });
    }
  }, [streamState.lastCompletedSeq, refetchHistory, queryClient, trpc.sessions.list]);

  // Find this session from the list to get metadata
  const allSessions = unwrapSessions(listData);
  const session = allSessions.find((s) => s.key === sessionKey);
  const messages = unwrapMessages(historyData);

  const wrapWithSidebar = (content: React.ReactNode) => (
    <div className="flex h-full w-full">
      <div className="hidden md:flex w-64 flex-col border-r border-zinc-800 overflow-y-auto shrink-0">
        <SessionsSidebar />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {content}
      </div>
    </div>
  );

  // Session not found — list loaded but key not found, and history also failed
  const listLoaded = !!listData;
  const sessionExists = !!session || (historyData && messages.length > 0);

  if (listLoaded && !sessionExists && !historyLoading && !historyData) {
    return wrapWithSidebar(
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="max-w-sm text-center">
          <h2 className="mb-2 text-lg font-semibold text-zinc-100">
            Session not found
          </h2>
          <p className="mb-1 text-sm text-zinc-400">
            No session with key{" "}
            <code className="rounded bg-zinc-800 px-1 text-xs font-mono">
              {sessionKey}
            </code>
          </p>
          <p className="mb-6 text-xs text-zinc-500">
            It may have expired or been removed.
          </p>
          <Link
            href="/sessions"
            className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-600"
          >
            Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  // Error loading history
  if (historyError && !historyLoading) {
    return wrapWithSidebar(
      <div className="flex h-full flex-col gap-4 p-6">
        <div>
          <h1 className="truncate text-lg font-semibold text-zinc-50">
            {sessionKey}
          </h1>
        </div>
        <QueryError
          error={historyErr}
          label="session transcript"
          onRetry={() => refetchHistory()}
        />
      </div>
    );
  }

  return wrapWithSidebar(
    <SessionStreamContext.Provider value={streamCtx}>
      <SessionWorkspace
        session={session ?? { key: sessionKey }}
        messages={messages as TranscriptMessage[]}
        isLoadingMessages={historyLoading}
      />
    </SessionStreamContext.Provider>
  );
}
