"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";

export function useGatewayHealth() {
  const trpc = useTRPC();
  const { data: health, isError } = useQuery({
    ...trpc.system.health.queryOptions(),
    refetchInterval: 5000,
  });

  const isOffline = isError || health?.connected === false;
  const methods: string[] = health?.methods ?? [];
  const events: string[] = health?.events ?? [];

  return {
    health,
    isOffline,
    methods,
    events,
    hasMethod: (m: string) => methods.includes(m),
    hasEvent: (e: string) => events.includes(e),
  };
}
