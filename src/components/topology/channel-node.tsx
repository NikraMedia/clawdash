"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

export interface ChannelNodeData {
  label: string;
  connected?: boolean;
  agentName?: string;
  dimmed?: boolean;
  [key: string]: unknown;
}

export type ChannelNodeType = Node<ChannelNodeData, "channel">;

function ChannelNodeComponent({ data }: NodeProps<ChannelNodeType>) {
  const { label, connected, agentName, dimmed } = data;

  const tooltip = [
    label,
    connected ? "Status: Connected" : "Status: Disconnected",
    agentName ? `Agent: ${agentName}` : "Unbound",
  ].join("\n");

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 rounded-full bg-glass px-4 py-2 shadow-lg backdrop-blur-md transition-all duration-300 cursor-pointer",
        connected
          ? "border-emerald-500/30 ring-1 ring-inset ring-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:bg-emerald-950/60 hover:border-emerald-500/50"
          : "border-zinc-800/60 hover:bg-zinc-900/40 hover:border-zinc-700/80",
        dimmed && "opacity-25 scale-[0.97]"
      )}
      title={tooltip}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Top}
        className={cn(
          "!w-2 !h-2 !border-[1.5px] !border-zinc-950 opacity-0 group-hover:opacity-100 transition-opacity",
          connected ? "!bg-emerald-500" : "!bg-zinc-600"
        )}
      />

      <div className="flex items-center gap-2 z-10">
        <div className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
          {connected && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            connected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-zinc-600"
          )} />
        </div>
        <span className={cn(
          "text-xs font-semibold tracking-tight",
          connected ? "text-zinc-100" : "text-zinc-400"
        )}>
          {label}
        </span>
        <Activity className={cn(
          "w-3.5 h-3.5 ml-1 opacity-70",
          connected ? "text-emerald-500" : "text-zinc-600"
        )} />
      </div>

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          "!w-2 !h-2 !border-[1.5px] !border-zinc-950",
          connected ? "!bg-emerald-500" : "!bg-zinc-600"
        )}
      />
    </div>
  );
}

export const ChannelNode = memo(ChannelNodeComponent);
