"use client";

import { cn } from "@/lib/utils";
import { useGatewayHealth } from "@/hooks/use-gateway-health";

type ConnectionStatus = "connected" | "reconnecting" | "offline";

const statusConfig: Record<
  ConnectionStatus,
  { color: string; pulse: boolean; label: string }
> = {
  connected: {
    color: "bg-emerald-500",
    pulse: false,
    label: "Connected",
  },
  reconnecting: {
    color: "bg-yellow-500",
    pulse: true,
    label: "Reconnecting",
  },
  offline: {
    color: "bg-red-500",
    pulse: false,
    label: "Offline",
  },
};

import { MobileSidebar } from "@/components/layout/sidebar";

export function Topbar() {
  const { health, isOffline } = useGatewayHealth();

  let status: ConnectionStatus;
  if (isOffline || health === undefined) {
    status = "offline";
  } else if (health.connected) {
    status = "connected";
  } else {
    status = "reconnecting";
  }

  const { color, pulse, label } = statusConfig[status];

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
      <div className="flex items-center">
        <MobileSidebar />
        <span className="text-sm font-semibold tracking-tight text-zinc-50">
          Claw Dash
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900/50 px-2.5 py-1 rounded-md border border-zinc-800/80 shadow-inner">
          <kbd className="font-sans text-[10px] font-medium tracking-widest text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded opacity-80">⌘K</kbd>
          <span>Search</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {pulse && (
              <span
                className={cn(
                  "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                  color
                )}
              />
            )}
            <span
              className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", color)}
            />
          </span>
          <span className="text-xs text-zinc-400">{label}</span>
        </div>
      </div>
    </header>
  );
}
