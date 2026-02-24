"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AgentNodeData {
  label: string;
  emoji?: string;
  model?: string;
  sessionCount: number;
  isDefault?: boolean;
  agentId: string;
  dimmed?: boolean;
  [key: string]: unknown;
}

export type AgentNodeType = Node<AgentNodeData, "agent">;

function AgentNodeComponent({ data }: NodeProps<AgentNodeType>) {
  const { label, emoji, model, sessionCount, isDefault, dimmed } = data;
  const isActive = sessionCount > 0;

  const tooltip = [
    label,
    model ? `Model: ${model}` : null,
    `Sessions: ${sessionCount}`,
    isDefault ? "Default Agent" : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center justify-center min-w-[160px] rounded-2xl px-5 py-4 transition-all duration-300 cursor-pointer",
        "bg-glass shadow-lg border-zinc-800/60",
        "hover:bg-zinc-900/60 hover:border-zinc-700/80 hover:shadow-xl",
        isDefault && "border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-inset ring-blue-500/20",
        isActive && "border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.15)] ring-1 ring-inset ring-emerald-500/20",
        dimmed && "opacity-25 scale-[0.97]"
      )}
      title={tooltip}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

      {/* Target handle from channels */}
      <Handle
        type="target"
        position={Position.Top}
        className={cn(
          "!h-2.5 !w-2.5 !border-2 !border-zinc-950 transition-colors",
          isActive ? "!bg-emerald-400" : "!bg-zinc-600"
        )}
      />

      <div className="flex flex-col items-center gap-2 relative z-10 w-full text-center">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-zinc-800/50 shadow-inner ring-1 ring-inset ring-white/5">
          {emoji ? (
            <span className="text-2xl drop-shadow-sm">{emoji}</span>
          ) : (
            <span className="text-xl font-bold text-zinc-500">A</span>
          )}
        </div>

        <span className="text-sm font-semibold tracking-tight text-zinc-100 mt-1">
          {label}
        </span>

        <div className="flex flex-col gap-1 w-full items-center">
          {isActive ? (
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 px-2.5 py-0 font-medium tracking-wide shadow-[0_0_10px_rgba(16,185,129,0.2)] text-[10px]"
            >
              {sessionCount} Session{sessionCount !== 1 ? "s" : ""}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-zinc-800/80 bg-zinc-900/50 text-zinc-500 px-2.5 py-0 font-medium text-[10px] shadow-none"
            >
              Idle
            </Badge>
          )}

          {isDefault && (
            <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 text-[9px] uppercase tracking-wider px-2 py-0 border-dashed">
              Default
            </Badge>
          )}
        </div>
      </div>

      {/* Source handle to cron jobs */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-zinc-950 !bg-zinc-600"
      />
    </div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
