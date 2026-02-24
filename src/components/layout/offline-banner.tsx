"use client";

import { useGatewayHealth } from "@/hooks/use-gateway-health";

/**
 * Persistent banner shown when gateway connection is lost.
 * Renders at top of viewport, pushes content down.
 * Automatically appears/disappears based on system.health query status.
 */
export function OfflineBanner() {
  const { isOffline } = useGatewayHealth();

  if (!isOffline) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-red-500/10 px-4 py-1.5 text-xs text-red-400 border-b border-red-500/20">
      <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
      <span>
        Gateway disconnected — showing cached data. Mutations are disabled.
      </span>
    </div>
  );
}
