"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
  Brain,
  Zap,
  Clock,
  ChevronDown,
  Trash2,
} from "lucide-react";

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
  onlineStatus?: "online" | "idle" | "inactive";
  lastActive?: string;
  tokenUsage?: string;
  cronCount?: number;
  onModelChange?: (model: string) => void;
  onMemoryClick?: () => void;
  onPingClick?: () => void;
  onSkillsClick?: () => void;
  onCronClick?: () => void;
  onDeleteClick?: () => void;
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

const AVAILABLE_MODELS = [
  "github-copilot/claude-sonnet-4.6",
  "github-copilot/claude-opus-4.6",
  "github-copilot/gpt-4o",
  "google/gemini-3.1-pro-preview",
];

const STATUS_DOT: Record<string, { bg: string; shadow: string; label: string }> = {
  online: { bg: "bg-emerald-400", shadow: "shadow-[0_0_6px_rgba(16,185,129,0.6)]", label: "Online" },
  idle: { bg: "bg-amber-400", shadow: "shadow-[0_0_6px_rgba(245,158,11,0.6)]", label: "Idle" },
  inactive: { bg: "bg-zinc-700", shadow: "", label: "Inactive" },
};

function HierarchyNodeComponent({ data }: NodeProps<HierarchyNodeType>) {
  const {
    label, emoji, role, model, isChef, color, dimmed,
    onlineStatus = "inactive",
    lastActive, tokenUsage, cronCount,
    onModelChange, onMemoryClick, onPingClick, onDeleteClick, onCronClick,
    agentId,
  } = data;
  const c = COLOR_CLASSES[color] ?? COLOR_CLASSES.zinc;
  const status = STATUS_DOT[onlineStatus] ?? STATUS_DOT.inactive;
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as HTMLElement)) {
        setShowModelDropdown(false);
      }
    };
    if (showModelDropdown) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showModelDropdown]);

  const isProtected = isChef || agentId === "manager";
  const shortModel = model?.split("/").pop() ?? "";

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
      style={{ minWidth: isChef ? 180 : 170 }}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />

      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-2 !border-zinc-950 !bg-zinc-600 !opacity-0"
        isConnectable={false}
      />

      <div className="flex flex-col items-center gap-1.5 relative z-10 w-full text-center">
        {/* Avatar */}
        <div className={cn(
          "flex items-center justify-center h-11 w-11 rounded-full shadow-inner ring-1 ring-inset ring-white/5",
          isChef ? "bg-amber-900/30" : "bg-zinc-800/50"
        )}>
          <span className="text-2xl drop-shadow-sm">{emoji}</span>
        </div>

        {/* Name */}
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          {label}
        </span>

        {/* Role */}
        <span className={cn("text-[10px] font-medium uppercase tracking-wider", c.text)}>
          {role}
        </span>

        {/* Model Badge with Dropdown */}
        {model && !isChef && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModelDropdown(!showModelDropdown);
              }}
              className="flex items-center gap-0.5 text-[9px] text-zinc-500 font-mono truncate max-w-[150px] hover:text-zinc-300 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-800/60"
            >
              {shortModel}
              <ChevronDown className="h-2.5 w-2.5 shrink-0" />
            </button>
            {showModelDropdown && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 py-1">
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m}
                    onClick={(e) => {
                      e.stopPropagation();
                      onModelChange?.(m);
                      setShowModelDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-zinc-800 transition-colors",
                      model === m ? "text-indigo-400" : "text-zinc-400"
                    )}
                  >
                    {m.split("/").pop()}
                    {model === m && <span className="ml-1 text-[9px]">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Last Active + Tokens */}
        {!isChef && (lastActive || tokenUsage) && (
          <div className="flex items-center gap-2 text-[9px] text-zinc-600">
            {lastActive && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {lastActive}
              </span>
            )}
            {tokenUsage && <span>{tokenUsage}</span>}
          </div>
        )}

        {/* Status dot */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn("inline-block h-2 w-2 rounded-full", status.bg, status.shadow)} />
          <span className="text-[9px] text-zinc-500">{status.label}</span>
        </div>

        {/* Action buttons row */}
        {!isChef && (
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onMemoryClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onMemoryClick(); }}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Memory"
              >
                <Brain className="h-3 w-3" />
              </button>
            )}
            {onPingClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onPingClick(); }}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Ping"
              >
                <Zap className="h-3 w-3" />
              </button>
            )}
            {cronCount !== undefined && cronCount > 0 && onCronClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onCronClick(); }}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                title={`${cronCount} Cron Jobs`}
              >
                <Clock className="h-3 w-3" />
                <span className="absolute -top-0.5 -right-0.5 bg-indigo-500 text-[7px] text-white rounded-full h-3 w-3 flex items-center justify-center">
                  {cronCount}
                </span>
              </button>
            )}
            {!isProtected && onDeleteClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteClick(); }}
                className="p-1 rounded hover:bg-red-900/40 text-zinc-600 hover:text-red-400 transition-colors"
                title="Delete Agent"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-2 !border-zinc-950 !bg-zinc-600 !opacity-0"
        isConnectable={false}
      />
    </div>
  );
}

export const HierarchyNode = memo(HierarchyNodeComponent);
