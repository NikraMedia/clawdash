"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

export interface HierarchyNodeData {
  label: string;
  emoji?: string;
  role: string;
  model?: string;
  isActive: boolean;
  isChef?: boolean;
  isManager?: boolean;
  agentId?: string;
  color: string;
  dimmed?: boolean;
  [key: string]: unknown;
}

export type HierarchyNodeType = Node<HierarchyNodeData, "hierarchy">;

const COLOR_CLASSES: Record<string, { border: string; glow: string; text: string }> = {
  gold: { border: "border-amber-400/50", glow: "shadow-[0_0_25px_rgba(251,191,36,0.2)]", text: "text-amber-400" },
  indigo: { border: "border-indigo-500/40", glow: "shadow-[0_0_20px_rgba(99,102,241,0.15)]", text: "text-indigo-400" },
  amber: { border: "border-amber-500/40", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]", text: "text-amber-400" },
  pink: { border: "border-pink-500/40", glow: "shadow-[0_0_20px_rgba(236,72,153,0.15)]", text: "text-pink-400" },
  orange: { border: "border-orange-500/40", glow: "shadow-[0_0_20px_rgba(249,115,22,0.15)]", text: "text-orange-400" },
  green: { border: "border-green-500/40", glow: "shadow-[0_0_20px_rgba(34,197,94,0.15)]", text: "text-green-400" },
  cyan: { border: "border-cyan-500/40", glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]", text: "text-cyan-400" },
  red: { border: "border-red-500/40", glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]", text: "text-red-400" },
  emerald: { border: "border-emerald-500/40", glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]", text: "text-emerald-400" },
  yellow: { border: "border-yellow-500/40", glow: "shadow-[0_0_20px_rgba(234,179,8,0.15)]", text: "text-yellow-400" },
  purple: { border: "border-purple-500/40", glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]", text: "text-purple-400" },
  blue: { border: "border-blue-500/40", glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]", text: "text-blue-400" },
  zinc: { border: "border-zinc-500/40", glow: "shadow-[0_0_20px_rgba(161,161,170,0.1)]", text: "text-zinc-400" },
};

function HierarchyNodeComponent({ data }: NodeProps<HierarchyNodeType>) {
  const { label, emoji, role, model, isActive, isChef, color, dimmed } = data;
  const c = COLOR_CLASSES[color] ?? COLOR_CLASSES.zinc;

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center justify-center rounded-2xl px-5 py-4 transition-all duration-300 cursor-pointer",
        "bg-zinc-950/80 border backdrop-blur-sm",
        c.border, c.glow,
        "hover:bg-zinc-900/60 hover:shadow-xl hover:scale-[1.03]",
        isChef && "ring-1 ring-inset ring-amber-400/30",
        dimmed && "opacity-25 scale-[0.97]"
      )}
      style={{ minWidth: isChef ? 180 : 160 }}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-2 !border-zinc-950 !bg-zinc-600 !opacity-0"
      />

      <div className="flex flex-col items-center gap-2 relative z-10 w-full text-center">
        <div className={cn(
          "flex items-center justify-center h-11 w-11 rounded-full shadow-inner ring-1 ring-inset ring-white/5",
          isChef ? "bg-amber-900/30" : "bg-zinc-800/50"
        )}>
          <span className="text-2xl drop-shadow-sm">{emoji}</span>
        </div>

        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          {label}
        </span>

        <span className={cn("text-[10px] font-medium uppercase tracking-wider", c.text)}>
          {role}
        </span>

        {model && (
          <span className="text-[9px] text-zinc-600 font-mono truncate max-w-[140px]">
            {model.split("/").pop()}
          </span>
        )}

        {/* Status dot */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn(
            "inline-block h-2 w-2 rounded-full",
            isActive
              ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
              : "bg-zinc-700"
          )} />
          <span className="text-[9px] text-zinc-500">
            {isActive ? "Online" : "Idle"}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-2 !border-zinc-950 !bg-zinc-600 !opacity-0"
      />
    </div>
  );
}

export const HierarchyNode = memo(HierarchyNodeComponent);
