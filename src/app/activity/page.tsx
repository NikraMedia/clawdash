"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTRPC } from "@/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import {
  Filters,
  type FilterState,
  type ActivityAgentOption,
} from "@/components/activity/filters";
import { EventFeed } from "@/components/activity/event-feed";
import { QueryError } from "@/components/ui/query-error";
import { SkeletonLines } from "@/components/ui/skeleton-rows";

function filtersFromParams(params: URLSearchParams): FilterState {
  return {
    showAll: params.get("showAll") === "true",
    agentId: params.get("agentId") ?? "",
    eventType: params.get("eventType") ?? "",
    severity: params.get("severity") ?? "",
  };
}

function ActivityPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = filtersFromParams(searchParams);

  const setFilters = useCallback(
    (next: FilterState) => {
      const params = new URLSearchParams();
      if (next.showAll) params.set("showAll", "true");
      if (next.agentId) params.set("agentId", next.agentId);
      if (next.eventType) params.set("eventType", next.eventType);
      if (next.severity) params.set("severity", next.severity);
      const qs = params.toString();
      if (qs === searchParams.toString()) return;
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const trpc = useTRPC();
  const { data: agentsData } = useQuery(trpc.agents.list.queryOptions());
  const {
    data: activityData,
    isError,
    error,
    refetch,
  } = useQuery(
    trpc.system.activity.queryOptions({ showAll: true, limit: 1 })
  );

  const agents = useMemo<ActivityAgentOption[]>(() => {
    const byId = new Map<string, ActivityAgentOption>();
    for (const agent of agentsData?.agents ?? []) {
      byId.set(agent.id, { id: agent.id, name: agent.name, emoji: agent.emoji });
    }
    for (const agentId of activityData?.meta.agentIds ?? []) {
      if (!byId.has(agentId)) byId.set(agentId, { id: agentId });
    }

    return [...byId.values()].sort((a, b) =>
      (a.name ?? a.id).localeCompare(b.name ?? b.id)
    );
  }, [activityData?.meta.agentIds, agentsData?.agents]);

  const eventTypes = useMemo(
    () => activityData?.meta.eventTypes ?? [],
    [activityData?.meta.eventTypes]
  );

  return (
    <>
      {isError ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <QueryError
            error={error}
            label="activity stream"
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Filters
              filters={filters}
              onChange={setFilters}
              agents={agents}
              eventTypes={eventTypes}
            />
          </div>
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
            <EventFeed filters={filters} onChange={setFilters} agents={agents} />
          </div>
        </div>
      )}
    </>
  );
}

export default function ActivityPage() {
  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold text-zinc-50">Activity Stream</h1>
          <p className="text-sm text-zinc-500">
            Real-time gateway events across all agents
          </p>
        </div>
        <Suspense fallback={<SkeletonLines count={6} />}>
          <ActivityPageContent />
        </Suspense>
      </div>
    </div>
  );
}
