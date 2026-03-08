"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { unwrapSessions } from "@/lib/gateway/unwrap";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "clawdash-read-sessions";
const POLL_INTERVAL = 30_000;

interface Notification {
  id: string;
  text: string;
  ts: number;
  type: "agent" | "cron";
}

function getReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

const AGENT_NAMES: Record<string, string> = {
  main: "Manager", ceo: "Steve", marketing: "Gary", content: "Jimmy",
  seo: "Neil", analytics: "Nate", sales: "Alex", finance: "Warren",
  tax: "Tom", legal: "Robert", "notion-systems": "Tiago", tech: "Pieter",
};

function formatSessionKey(key: string): string {
  // "agent:main:main" → "Manager"
  // "agent:tech:subagent:xxx" → "Pieter (Subagent)"
  const parts = key.replace(/^telegram:g-/, "").split(":");
  // parts: ["agent", agentId, type?, ...]
  const agentId = parts.length > 1 ? parts[1] : parts[0];
  const type = parts.length > 2 ? parts[2] : undefined;
  const name = AGENT_NAMES[agentId] ?? agentId;
  if (type === "cron") return `Cron abgeschlossen (${name})`;
  if (type === "subagent") return `${name} (Subagent)`;
  if (type === "rt" || type === "roundtable") return `${name} (Roundtable)`;
  return name;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const trpc = useTRPC();

  useEffect(() => {
    setReadIds(getReadIds());
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const { data: sessionsData } = useQuery({
    ...trpc.sessions.list.queryOptions({
      limit: 50,
      includeDerivedTitles: true,
      includeLastMessage: true,
    }),
    refetchInterval: POLL_INTERVAL,
  });

  const sessions = unwrapSessions(sessionsData);

  // Build notifications from recent sessions
  const notifications: Notification[] = sessions
    .filter((s) => s.updatedAt && s.updatedAt > Date.now() - 3600_000) // last hour
    .map((s) => {
      const isCron = s.key.includes("cron") || s.origin?.surface === "cron";
      return {
        id: s.key,
        text: isCron
          ? `Cron: ${s.derivedTitle ?? s.label ?? formatSessionKey(s.key)} abgeschlossen`
          : `${formatSessionKey(s.key)} hat geantwortet`,
        ts: s.updatedAt ?? 0,
        type: (isCron ? "cron" : "agent") as "cron" | "agent",
      };
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = useCallback(() => {
    const newIds = new Set(readIds);
    notifications.forEach((n) => newIds.add(n.id));
    setReadIds(newIds);
    saveReadIds(newIds);
  }, [readIds, notifications]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-md hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-zinc-800/80 bg-zinc-950 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
            <span className="text-sm font-medium text-zinc-200">Benachrichtigungen</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Alle als gelesen markieren
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-[11px] text-zinc-600">
                Keine neuen Benachrichtigungen
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-2.5 border-b border-zinc-800/30 text-[12px] transition-colors",
                    readIds.has(n.id) ? "text-zinc-500" : "text-zinc-300 bg-zinc-900/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {!readIds.has(n.id) && (
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                    )}
                    <span className="flex-1 truncate">{n.text}</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {new Date(n.ts).toLocaleString("de-DE")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
