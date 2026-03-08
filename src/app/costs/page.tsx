"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { DollarSign, Zap, Bot, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const PERIODS = [
  { label: "Heute", days: 1 },
  { label: "7 Tage", days: 7 },
  { label: "30 Tage", days: 30 },
] as const;

function fmt$(n: number) {
  return `$${n.toFixed(4)}`;
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function CostsPage() {
  const [days, setDays] = useState(1);
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.costs.summary.queryOptions({ days })
  );

  const maxCost = data?.agents?.reduce((m, a) => Math.max(m, a.cost), 0) ?? 1;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 px-4 sm:px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-emerald-400" />
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Kosten</h1>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Token-Verbrauch und geschätzte Kosten pro Agent
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-zinc-900/50 rounded-lg p-0.5 border border-zinc-800/80">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                days === p.days
                  ? "bg-zinc-800 text-zinc-200 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1 text-zinc-600 text-sm">
          Lade Daten...
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card icon={Zap} label="Total Tokens" value={fmtTokens((data?.totalInput ?? 0) + (data?.totalOutput ?? 0))} color="text-amber-400" />
            <Card icon={DollarSign} label="Total Kosten" value={fmt$(data?.totalCost ?? 0)} color="text-emerald-400" />
            <Card icon={Bot} label="Aktivster Agent" value={data?.mostActive ?? "—"} color="text-indigo-400" />
            <Card icon={TrendingUp} label="Durchschnitt/Session" value={fmt$(data?.avgPerSession ?? 0)} color="text-sky-400" />
          </div>

          {/* Agent table */}
          <div className="rounded-xl border border-zinc-800/60 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60 text-[11px] text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Agent</th>
                  <th className="text-right px-4 py-3 font-medium">Sessions</th>
                  <th className="text-right px-4 py-3 font-medium">Input Tokens</th>
                  <th className="text-right px-4 py-3 font-medium">Output Tokens</th>
                  <th className="text-right px-4 py-3 font-medium">Kosten</th>
                  <th className="px-4 py-3 font-medium w-48"></th>
                </tr>
              </thead>
              <tbody>
                {(data?.agents ?? []).map((a) => (
                  <tr key={a.agentId} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                    <td className="px-4 py-3 text-zinc-200 font-medium capitalize">{a.agentId}</td>
                    <td className="px-4 py-3 text-right text-zinc-400">{a.sessions}</td>
                    <td className="px-4 py-3 text-right text-zinc-400">{fmtTokens(a.inputTokens)}</td>
                    <td className="px-4 py-3 text-right text-zinc-400">{fmtTokens(a.outputTokens)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-mono">{fmt$(a.cost)}</td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-zinc-800/50 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all"
                          style={{ width: `${maxCost > 0 ? (a.cost / maxCost) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {(data?.agents ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-zinc-600">
                      Keine Daten für diesen Zeitraum
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ icon: Icon, label, value, color }: { icon: typeof DollarSign; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-[11px] text-zinc-500 font-medium">{label}</span>
      </div>
      <p className="text-xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
