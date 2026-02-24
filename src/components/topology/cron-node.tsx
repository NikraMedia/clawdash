"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

export interface CronNodeData {
  label: string;
  status?: "ok" | "error" | "timeout";
  enabled?: boolean;
  schedule?: string;
  agentId: string;
  dimmed?: boolean;
  [key: string]: unknown;
}

export type CronNodeType = Node<CronNodeData, "cron">;

function CronNodeComponent({ data }: NodeProps<CronNodeType>) {
  const { label, status, enabled = true, schedule, dimmed } = data;

  const statusLabel =
    status === "error" ? "Error" : status === "timeout" ? "Timeout" : "OK";
  const tooltip = [
    label,
    schedule ? `Schedule: ${schedule}` : null,
    `Status: ${statusLabel}`,
    enabled ? "Enabled" : "Disabled",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-xl border bg-zinc-950/80 px-3.5 py-2 shadow-lg backdrop-blur-xl ring-1 ring-inset transition-all duration-300 cursor-pointer",
        enabled && "hover:scale-[1.02]",
        status === "error"
          ? "border-red-500/40 bg-red-950/30 ring-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.15)] hover:bg-red-950/40"
          : status === "timeout"
            ? "border-amber-500/40 bg-amber-950/30 ring-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:bg-amber-950/40"
            : "border-zinc-800/80 ring-white/5 shadow-[0_0_15px_rgba(255,255,255,0.02)] hover:bg-zinc-900/80 hover:border-zinc-700/80",
        !enabled && "border-dashed opacity-50",
        dimmed && "opacity-25 scale-[0.97]"
      )}
      title={tooltip}
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

      <Handle
        type="target"
        position={Position.Top}
        className={cn(
          "!h-2 !w-2 !border-[1.5px] !border-zinc-950 !bg-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity"
        )}
      />

      <Clock className={cn(
        "w-3.5 h-3.5 shrink-0 opacity-70",
        status === "error" ? "text-red-400" : status === "timeout" ? "text-amber-400" : "text-zinc-500"
      )} />

      <span className="relative flex h-2 w-2 shrink-0">
        <span className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
          status === "error" ? "bg-red-400 duration-700" : status === "timeout" ? "bg-amber-400 duration-1000" : "bg-emerald-400 duration-3000"
        )} />
        <span className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          status === "error" ? "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]" : status === "timeout" ? "bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.8)]" : "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"
        )} />
      </span>

      <span
        className={cn(
          "text-[11px] font-semibold tracking-wide uppercase font-mono",
          status === "error" ? "text-red-300" : status === "timeout" ? "text-amber-300" : "text-zinc-300"
        )}
      >
        {label.length > 22 ? label.slice(0, 20) + "…" : label}
      </span>
    </div>
  );
}

export const CronNode = memo(CronNodeComponent);
