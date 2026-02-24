"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Clock } from "lucide-react";
import { scheduleToHuman } from "@/lib/cron-utils";
import type { CronJob } from "@/types/gateway";

interface TimelineViewProps {
  jobs: CronJob[];
}

// Dynamic color palette — assigned by stable index from sorted agent IDs
const COLOR_PALETTE = [
  { bg: "bg-indigo-500/20", dot: "bg-indigo-500", glow: "shadow-[0_0_8px_rgba(99,102,241,0.5)]", text: "text-indigo-400" },
  { bg: "bg-violet-500/20", dot: "bg-violet-500", glow: "shadow-[0_0_8px_rgba(139,92,246,0.5)]", text: "text-violet-400" },
  { bg: "bg-amber-500/20", dot: "bg-amber-500", glow: "shadow-[0_0_8px_rgba(245,158,11,0.5)]", text: "text-amber-400" },
  { bg: "bg-emerald-500/20", dot: "bg-emerald-500", glow: "shadow-[0_0_8px_rgba(16,185,129,0.5)]", text: "text-emerald-400" },
  { bg: "bg-cyan-500/20", dot: "bg-cyan-500", glow: "shadow-[0_0_8px_rgba(6,182,212,0.5)]", text: "text-cyan-400" },
  { bg: "bg-rose-500/20", dot: "bg-rose-500", glow: "shadow-[0_0_8px_rgba(244,63,94,0.5)]", text: "text-rose-400" },
  { bg: "bg-orange-500/20", dot: "bg-orange-500", glow: "shadow-[0_0_8px_rgba(249,115,22,0.5)]", text: "text-orange-400" },
  { bg: "bg-teal-500/20", dot: "bg-teal-500", glow: "shadow-[0_0_8px_rgba(20,184,166,0.5)]", text: "text-teal-400" },
];

function parseCronHours(expr: string): number[] {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return [];

  const hourField = parts[1];
  if (!hourField) return [];

  const hours: Set<number> = new Set();

  const segments = hourField.split(",");
  for (const segment of segments) {
    if (segment.includes("/")) {
      const [range, stepStr] = segment.split("/");
      const step = parseInt(stepStr ?? "1", 10);
      if (isNaN(step) || step < 1) continue;

      let start = 0;
      let end = 23;
      if (range && range !== "*") {
        if (range.includes("-")) {
          const [lo, hi] = range.split("-");
          start = parseInt(lo ?? "0", 10);
          end = parseInt(hi ?? "23", 10);
        } else {
          start = parseInt(range, 10);
        }
      }
      for (let h = start; h <= end; h += step) {
        if (h >= 0 && h <= 23) hours.add(h);
      }
    } else if (segment.includes("-")) {
      const [lo, hi] = segment.split("-");
      const start = parseInt(lo ?? "0", 10);
      const end = parseInt(hi ?? "23", 10);
      for (let h = start; h <= end; h++) {
        if (h >= 0 && h <= 23) hours.add(h);
      }
    } else if (segment === "*") {
      for (let h = 0; h <= 23; h++) hours.add(h);
    } else {
      const h = parseInt(segment, 10);
      if (!isNaN(h) && h >= 0 && h <= 23) hours.add(h);
    }
  }

  return Array.from(hours).sort((a, b) => a - b);
}

function HourLabel({ hour, isNow }: { hour: number; isNow?: boolean }) {
  const display =
    hour === 0
      ? "12a"
      : hour < 12
        ? `${hour}a`
        : hour === 12
          ? "12p"
          : `${hour - 12}p`;
  return (
    <span
      className={cn(
        "text-[10px] tabular-nums font-medium transition-colors cursor-default",
        isNow ? "text-emerald-400" : "text-zinc-500"
      )}
    >
      {display}
    </span>
  );
}

export function TimelineView({ jobs }: TimelineViewProps) {
  const cronJobs = useMemo(
    () => jobs.filter((j) => j.schedule.kind === "cron" && j.schedule.expr),
    [jobs]
  );

  // Build stable agent-to-color mapping
  const agentColorMap = useMemo(() => {
    const uniqueAgents = Array.from(
      new Set(cronJobs.map((j) => j.agentId))
    ).sort();
    const map = new Map<string, (typeof COLOR_PALETTE)[number]>();
    uniqueAgents.forEach((agentId, i) => {
      map.set(agentId, COLOR_PALETTE[i % COLOR_PALETTE.length]!);
    });
    return map;
  }, [cronJobs]);

  // Compute scheduling density per hour (how many jobs fire)
  const hourlyDensity = useMemo(() => {
    const density = new Array(24).fill(0) as number[];
    for (const job of cronJobs) {
      if (!job.enabled) continue;
      const fireHours = parseCronHours(job.schedule.expr!);
      for (const h of fireHours) {
        density[h]!++;
      }
    }
    return density;
  }, [cronJobs]);

  const maxDensity = Math.max(...hourlyDensity, 1);

  if (cronJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 p-8 text-center shadow-inner">
        <Clock className="h-8 w-8 text-zinc-600 mb-3" />
        <p className="text-sm font-medium text-zinc-400">
          No timeline data available
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Requires jobs with explicit cron expressions.
        </p>
      </div>
    );
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const currentHour = new Date().getHours();

  return (
    <div className="rounded-xl border border-white/5 bg-glass p-5 shadow-xl transition-all relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent opacity-50" />

      {/* Hour labels */}
      <div className="mb-2 flex px-2">
        <div className="w-40 shrink-0" />
        <div className="flex flex-1 relative">
          <div
            className="absolute top-4 bottom-[-400px] w-px bg-gradient-to-b from-emerald-500/50 to-transparent z-0 pointer-events-none"
            style={{ left: `${(currentHour / 24) * 100}%` }}
          />

          {hours.map((h) => (
            <div
              key={h}
              className="flex-1 flex justify-center relative z-10"
              style={{ minWidth: 0 }}
            >
              <div className="w-full flex justify-center -translate-x-1/2 absolute left-1/2">
                {h % 3 === 0 && (
                  <HourLabel hour={h} isNow={currentHour === h} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Job rows */}
      <div className="flex flex-col gap-2 relative z-10 px-2 pb-2">
        {cronJobs.map((job) => {
          const fireHours = parseCronHours(job.schedule.expr!);
          const config = agentColorMap.get(job.agentId) ?? COLOR_PALETTE[0]!;
          const humanDesc = scheduleToHuman(job.schedule);

          return (
            <div
              key={job.id}
              className="group/row flex items-center p-1.5 -mx-1.5 rounded-lg border border-transparent hover:bg-zinc-800/60 hover:border-zinc-800/80 transition-all duration-200"
            >
              <div className="w-40 shrink-0 pr-4">
                <span
                  className={cn(
                    "truncate block text-xs font-medium tracking-tight",
                    job.enabled
                      ? "text-zinc-200 group-hover/row:text-white"
                      : "text-zinc-600"
                  )}
                  title={job.name}
                >
                  {job.name}
                </span>
                <span
                  className={cn(
                    "block text-[10px] truncate mt-0.5 opacity-70",
                    config.text
                  )}
                >
                  {job.agentId}
                </span>
              </div>

              <div className="relative flex flex-1 h-7 rounded-sm bg-zinc-950/40 border border-zinc-800/50 shadow-inner overflow-hidden">
                {hours.map((h) => {
                  const fires = fireHours.includes(h);
                  const isCurrent = currentHour === h;
                  return (
                    <div
                      key={h}
                      className={cn(
                        "flex-1 flex items-center justify-center border-r border-zinc-800/30 last:border-r-0 relative transition-colors duration-300",
                        h % 3 === 0 && "border-r-zinc-700/50",
                        isCurrent && "bg-emerald-500/[0.03]",
                        fires && "hover:bg-white/5 cursor-pointer"
                      )}
                      style={{ minWidth: 0 }}
                    >
                      {fires && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                "h-[85%] w-[85%] rounded-[2px] opacity-70 transition-all duration-300 hover:opacity-100 hover:scale-[1.15]",
                                config.bg,
                                !job.enabled && "opacity-20 grayscale"
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="bg-zinc-900 border-zinc-800 shadow-xl m-1 p-3 flex flex-col gap-1.5 animate-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95"
                          >
                            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-1.5">
                              <span className="font-semibold text-zinc-100 text-sm tracking-tight">
                                {job.name}
                              </span>
                              <span className="text-zinc-400 text-xs font-mono">
                                {h.toString().padStart(2, "0")}:00
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <span className="text-zinc-500">Agent</span>
                              <span
                                className={cn("font-medium", config.text)}
                              >
                                {job.agentId}
                              </span>
                              <span className="text-zinc-500">Schedule</span>
                              <span className="text-zinc-200 font-medium">
                                {humanDesc}
                              </span>
                              <span className="text-zinc-500">Expression</span>
                              <code className="text-zinc-300 font-mono text-[10px] bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800">
                                {job.schedule.expr}
                              </code>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Density indicator */}
      <div className="flex px-2 mt-1 mb-2">
        <div className="w-40 shrink-0 pr-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-600">
            Density
          </span>
        </div>
        <div className="flex flex-1 h-3 rounded-sm overflow-hidden">
          {hours.map((h) => {
            const density = hourlyDensity[h]!;
            const intensity = density / maxDensity;
            return (
              <Tooltip key={h}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex-1 border-r border-zinc-800/30 last:border-r-0 transition-colors",
                      density > 0 && "cursor-help"
                    )}
                    style={{
                      minWidth: 0,
                      backgroundColor:
                        density > 0
                          ? `rgba(99, 102, 241, ${0.1 + intensity * 0.4})`
                          : undefined,
                    }}
                  />
                </TooltipTrigger>
                {density > 0 && (
                  <TooltipContent
                    side="bottom"
                    className="bg-zinc-800 border-zinc-700 text-zinc-200 text-xs"
                  >
                    {density} active job{density > 1 ? "s" : ""} at{" "}
                    {h.toString().padStart(2, "0")}:00
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 border-t border-zinc-800/60 pt-4 px-2">
        {Array.from(agentColorMap.entries()).map(([agentId, config]) => (
          <div
            key={agentId}
            className="flex items-center gap-2 bg-zinc-950/30 px-2.5 py-1.5 rounded-full border border-zinc-800/40"
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                config.dot,
                config.glow
              )}
            />
            <span className="text-[10px] font-medium text-zinc-400 capitalize">
              {agentId}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
