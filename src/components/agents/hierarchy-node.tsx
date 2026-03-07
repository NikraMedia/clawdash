"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Brain,
  Wrench,
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
  onChatClick?: () => void;
  onMemoryClick?: () => void;
  onPingClick?: () => void;
  onSkillsClick?: () => void;
  onCronClick?: () => void;
  onDeleteClick?: () => void;
  [key: string]: unknown;
}

export type HierarchyNodeType = Node<HierarchyNodeData, "hierarchy">;

const COLOR_CLASSES: Record<string, { border: string; glow: string; text: string; accent: string }> = {
  gold: { border: "border-amber-400/50", glow: "shadow-[0_0_25px_rgba(251,191,36,0.2)]", text: "text-amber-400", accent: "#fbbf24" },
  indigo: { border: "border-indigo-500/40", glow: "shadow-[0_0_20px_rgba(99,102,241,0.15)]", text: "text-indigo-400", accent: "#818cf8" },
  amber: { border: "border-amber-500/40", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]", text: "text-amber-400", accent: "#f59e0b" },
  pink: { border: "border-pink-500/40", glow: "shadow-[0_0_20px_rgba(236,72,153,0.15)]", text: "text-pink-400", accent: "#ec4899" },
  orange: { border: "border-orange-500/40", glow: "shadow-[0_0_20px_rgba(249,115,22,0.15)]", text: "text-orange-400", accent: "#f97316" },
  green: { border: "border-green-500/40", glow: "shadow-[0_0_20px_rgba(34,197,94,0.15)]", text: "text-green-400", accent: "#22c55e" },
  cyan: { border: "border-cyan-500/40", glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]", text: "text-cyan-400", accent: "#06b6d4" },
  red: { border: "border-red-500/40", glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]", text: "text-red-400", accent: "#ef4444" },
  emerald: { border: "border-emerald-500/40", glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]", text: "text-emerald-400", accent: "#10b981" },
  yellow: { border: "border-yellow-500/40", glow: "shadow-[0_0_20px_rgba(234,179,8,0.15)]", text: "text-yellow-400", accent: "#eab308" },
  purple: { border: "border-purple-500/40", glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]", text: "text-purple-400", accent: "#a855f7" },
  blue: { border: "border-blue-500/40", glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]", text: "text-blue-400", accent: "#3b82f6" },
  zinc: { border: "border-zinc-500/40", glow: "shadow-[0_0_20px_rgba(161,161,170,0.1)]", text: "text-zinc-400", accent: "#a1a1aa" },
};

const AVAILABLE_MODELS = [
  "github-copilot/claude-sonnet-4.6",
  "github-copilot/claude-opus-4.6",
  "github-copilot/gpt-4o",
  "google/gemini-3.1-pro-preview",
];

const STATUS_DOT: Record<string, { bg: string; shadow: string; label: string }> = {
  online: { bg: "bg-emerald-400", shadow: "shadow-[0_0_8px_rgba(16,185,129,0.6)]", label: "Online" },
  idle: { bg: "bg-amber-400", shadow: "shadow-[0_0_8px_rgba(245,158,11,0.6)]", label: "Idle" },
  inactive: { bg: "bg-zinc-600", shadow: "", label: "Inactive" },
};

const HANDLE_STYLE = {
  width: 12,
  height: 12,
  background: "#ffffff",
  border: "2px solid #4f46e5",
  transition: "all 0.2s ease",
};

function HierarchyNodeComponent({ data }: NodeProps<HierarchyNodeType>) {
  const {
    label, emoji, role, model, isChef, isManager, color, dimmed,
    onlineStatus = "inactive",
    onModelChange, onChatClick, onMemoryClick, onSkillsClick, onCronClick, onDeleteClick,
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

  const shortModel = model?.split("/").pop() ?? "no model";

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl transition-all duration-300 cursor-pointer",
        "bg-zinc-950/90 border-2 backdrop-blur-sm",
        c.border, c.glow,
        "hover:bg-zinc-900/70 hover:shadow-2xl hover:scale-[1.02]",
        isChef && "ring-1 ring-inset ring-amber-400/30",
        dimmed && "opacity-20 scale-[0.97]"
      )}
    >
      {/* TOP Handle (target) - Blender style */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          ...HANDLE_STYLE,
          opacity: 0.6,
        }}
        className="!opacity-60 group-hover:!opacity-100 hover:!bg-indigo-400 hover:!border-indigo-300 hover:!shadow-[0_0_8px_rgba(99,102,241,0.5)]"
        isConnectable={true}
      />

      {/* BOTTOM Handle (source) - Blender style */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          ...HANDLE_STYLE,
          opacity: 0.6,
        }}
        className="!opacity-60 group-hover:!opacity-100 hover:!bg-indigo-400 hover:!border-indigo-300 hover:!shadow-[0_0_8px_rgba(99,102,241,0.5)]"
        isConnectable={true}
      />

      <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-2 w-full text-center">
        {/* Emoji + Name */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{emoji}</span>
          <span className="text-base font-bold tracking-tight text-zinc-100">
            {label}
          </span>
        </div>

        {/* Role */}
        <span className={cn("text-xs font-medium uppercase tracking-wider", c.text)}>
          {role}
        </span>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-full", status.bg, status.shadow)} />
          <span className="text-xs text-zinc-400">{status.label}</span>
        </div>

        {/* Model Dropdown - always visible */}
        {model && (
          <div className="relative w-full" ref={dropdownRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModelDropdown(!showModelDropdown);
              }}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] text-zinc-300 font-mono bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 hover:border-zinc-600 rounded-lg px-3 py-1.5 transition-all"
            >
              <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", showModelDropdown && "rotate-180")} />
              {shortModel}
            </button>
            {showModelDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-600 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m}
                    onClick={(e) => {
                      e.stopPropagation();
                      onModelChange?.(m);
                      setShowModelDropdown(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-[11px] font-mono hover:bg-zinc-800 transition-colors",
                      model === m ? "text-indigo-400 bg-indigo-500/10" : "text-zinc-400"
                    )}
                  >
                    {m.split("/").pop()}
                    {model === m && <span className="ml-2 text-indigo-400">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="mx-3 border-t border-zinc-700/50" />

      {/* Action Icons - always visible */}
      <div className="flex items-center justify-center gap-1 px-3 py-2.5">
        {onChatClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onChatClick(); }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-indigo-400 transition-all"
            title="Chat"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        )}
        {onMemoryClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onMemoryClick(); }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-purple-400 transition-all"
            title="Memory"
          >
            <Brain className="h-4 w-4" />
          </button>
        )}
        {onSkillsClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onSkillsClick(); }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-blue-400 transition-all"
            title="Skills"
          >
            <Wrench className="h-4 w-4" />
          </button>
        )}
        {onCronClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onCronClick(); }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 transition-all"
            title="Cron Jobs"
          >
            <Clock className="h-4 w-4" />
          </button>
        )}
        {!isChef && agentId !== "manager" && onDeleteClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteClick(); }}
            className="p-1.5 rounded-lg hover:bg-red-900/40 text-zinc-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
            title="Delete Agent"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export const HierarchyNode = memo(HierarchyNodeComponent);
