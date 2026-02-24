"use client";

import { Badge } from "@/components/ui/badge";
import { formatTokens } from "@/lib/format";
import type { SessionMeta } from "./session-workspace";

interface ConfigPanelProps {
  session: SessionMeta;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  const isEmpty = value == null || value === "" || value === "—";
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
      <span className={`text-xs text-right ${isEmpty ? "text-zinc-600" : "text-zinc-300"}`}>
        {isEmpty ? "—" : value}
      </span>
    </div>
  );
}

export function ConfigPanel({ session }: ConfigPanelProps) {
  // Check if any token data exists
  const hasTokens = (session.inputTokens ?? 0) > 0 || (session.outputTokens ?? 0) > 0 || (session.totalTokens ?? 0) > 0;

  // Filter origin rows to only show populated fields
  const originRows = session.origin ? [
    { label: "Surface", value: session.origin.surface },
    { label: "Provider", value: session.origin.provider },
    { label: "Chat Type", value: session.origin.chatType },
    { label: "From", value: session.origin.from },
    { label: "To", value: session.origin.to },
  ].filter(r => r.value) : [];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Model */}
      <div>
        <h4 className="text-xs font-medium text-zinc-400 mb-2">Model</h4>
        <div className="flex flex-col divide-y divide-zinc-800">
          <Row label="Model" value={session.model} />
          <Row label="Provider" value={session.modelProvider} />
          <Row
            label="Thinking"
            value={
              session.thinkingLevel ? (
                <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
                  {session.thinkingLevel}
                </Badge>
              ) : null
            }
          />
        </div>
      </div>

      {/* Token Usage */}
      <div>
        <h4 className="text-xs font-medium text-zinc-400 mb-2">Token Usage</h4>
        {hasTokens ? (
          <div className="flex flex-col divide-y divide-zinc-800">
            <Row label="Input" value={formatTokens(session.inputTokens)} />
            <Row label="Output" value={formatTokens(session.outputTokens)} />
            <Row label="Total" value={formatTokens(session.totalTokens)} />
            <Row label="Context" value={formatTokens(session.contextTokens)} />
          </div>
        ) : (
          <p className="text-[11px] text-zinc-600 italic">
            Token data will populate after the first response completes.
          </p>
        )}
      </div>

      {/* Origin — only show if we have at least one populated field */}
      {originRows.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-2">Origin</h4>
          <div className="flex flex-col divide-y divide-zinc-800">
            {originRows.map(r => (
              <Row key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        </div>
      )}

      {/* Session Info */}
      <div>
        <h4 className="text-xs font-medium text-zinc-400 mb-2">Session</h4>
        <div className="flex flex-col divide-y divide-zinc-800">
          <Row label="Kind" value={session.kind} />
          <Row label="Channel" value={session.channel} />
        </div>
      </div>
    </div>
  );
}
