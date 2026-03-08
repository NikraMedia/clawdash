"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  Check,
  X,
  Clock,
  AlertTriangle,
  Trash2,
  Send,
  FileEdit,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface PermissionRequest {
  id: string;
  agentId: string;
  agentName: string;
  action: "delete" | "external_send" | "file_edit" | "install" | "config_change";
  description: string;
  target?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  resolvedAt?: number;
}

const ACTION_META: Record<string, { label: string; icon: typeof Trash2; color: string }> = {
  delete: { label: "Löschen", icon: Trash2, color: "red" },
  external_send: { label: "Extern senden", icon: Send, color: "amber" },
  file_edit: { label: "Datei ändern", icon: FileEdit, color: "blue" },
  install: { label: "Installieren", icon: AlertTriangle, color: "orange" },
  config_change: { label: "Config ändern", icon: AlertTriangle, color: "purple" },
};

const STORAGE_KEY = "clawdash-permission-requests";

// Mock data for initial state
const MOCK_REQUESTS: PermissionRequest[] = [
  {
    id: "req-1",
    agentId: "pieter",
    agentName: "Pieter",
    action: "delete",
    description: "Alte Log-Dateien löschen (>30 Tage)",
    target: "C:\\Users\\Nikra\\.openclaw\\logs\\*.old",
    status: "pending",
    createdAt: Date.now() - 3600000,
  },
  {
    id: "req-2",
    agentId: "gary",
    agentName: "Gary",
    action: "external_send",
    description: "Newsletter an 150 Subscriber senden",
    target: "marketing@nikramedia.de",
    status: "pending",
    createdAt: Date.now() - 7200000,
  },
  {
    id: "req-3",
    agentId: "warren",
    agentName: "Warren",
    action: "config_change",
    description: "Budget-Limit von 500€ auf 1000€ erhöhen",
    status: "pending",
    createdAt: Date.now() - 1800000,
  },
  {
    id: "req-4",
    agentId: "tiago",
    agentName: "Tiago",
    action: "delete",
    description: "Verwaiste Notion-Seiten archivieren (12 Seiten)",
    status: "approved",
    createdAt: Date.now() - 86400000,
    resolvedAt: Date.now() - 82800000,
  },
  {
    id: "req-5",
    agentId: "neil",
    agentName: "Neil",
    action: "external_send",
    description: "Backlink-Outreach E-Mails senden (50 Empfänger)",
    status: "rejected",
    createdAt: Date.now() - 172800000,
    resolvedAt: Date.now() - 170000000,
  },
];

function loadRequests(): PermissionRequest[] {
  if (typeof window === "undefined") return MOCK_REQUESTS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  // First load: seed with mock data
  localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_REQUESTS));
  return MOCK_REQUESTS;
}

function saveRequests(requests: PermissionRequest[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

type FilterStatus = "all" | "pending" | "approved" | "rejected";

export default function PermissionsPage() {
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setRequests(loadRequests());
    setLoaded(true);
  }, []);

  // Save on change
  useEffect(() => {
    if (loaded) saveRequests(requests);
  }, [requests, loaded]);

  const filtered = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const handleApprove = useCallback((id: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "approved" as const, resolvedAt: Date.now() } : r
      )
    );
  }, []);

  const handleReject = useCallback((id: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "rejected" as const, resolvedAt: Date.now() } : r
      )
    );
  }, []);

  const handleClearResolved = useCallback(() => {
    setRequests((prev) => prev.filter((r) => r.status === "pending"));
  }, []);

  const filters: { id: FilterStatus; label: string }[] = [
    { id: "all", label: "Alle" },
    { id: "pending", label: `Offen (${pendingCount})` },
    { id: "approved", label: "Genehmigt" },
    { id: "rejected", label: "Abgelehnt" },
  ];

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-amber-400" />
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Berechtigungen</h1>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {pendingCount} offene Requests · Manager-Genehmigung erforderlich
            </p>
          </div>
        </div>
        <Button
          onClick={handleClearResolved}
          variant="ghost"
          size="sm"
          className="h-8 text-[11px] text-zinc-400 hover:text-zinc-200"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Erledigte löschen
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800/40 px-6 py-2 shrink-0">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
              filter === f.id
                ? "bg-zinc-800 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Request list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6 space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Shield className="h-12 w-12 text-zinc-700 mb-4" />
              <p className="text-sm text-zinc-500">Keine Requests</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                {filter === "pending"
                  ? "Alle Requests wurden bearbeitet"
                  : "Noch keine Berechtigungs-Anfragen"}
              </p>
            </div>
          ) : (
            filtered.map((req) => {
              const meta = ACTION_META[req.action] ?? ACTION_META.config_change;
              const Icon = meta.icon;
              return (
                <div
                  key={req.id}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border transition-colors",
                    req.status === "pending"
                      ? "bg-zinc-900/80 border-zinc-700/60"
                      : "bg-zinc-900/40 border-zinc-800/40 opacity-70"
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex items-center justify-center h-10 w-10 rounded-lg shrink-0",
                      meta.color === "red" && "bg-red-500/10 text-red-400",
                      meta.color === "amber" && "bg-amber-500/10 text-amber-400",
                      meta.color === "blue" && "bg-blue-500/10 text-blue-400",
                      meta.color === "orange" && "bg-orange-500/10 text-orange-400",
                      meta.color === "purple" && "bg-purple-500/10 text-purple-400"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-zinc-200">
                        {req.agentName}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded font-medium",
                          meta.color === "red" && "bg-red-500/10 text-red-400",
                          meta.color === "amber" && "bg-amber-500/10 text-amber-400",
                          meta.color === "blue" && "bg-blue-500/10 text-blue-400",
                          meta.color === "orange" && "bg-orange-500/10 text-orange-400",
                          meta.color === "purple" && "bg-purple-500/10 text-purple-400"
                        )}
                      >
                        {meta.label}
                      </span>
                      {req.status !== "pending" && (
                        <span
                          className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-medium",
                            req.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          )}
                        >
                          {req.status === "approved" ? "Genehmigt" : "Abgelehnt"}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-zinc-300">{req.description}</p>
                    {req.target && (
                      <p className="text-[10px] text-zinc-500 font-mono mt-1">
                        {req.target}
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-600 mt-1.5">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {new Date(req.createdAt).toLocaleString("de-DE")}
                      {req.resolvedAt && (
                        <span>
                          {" · Bearbeitet: "}
                          {new Date(req.resolvedAt).toLocaleString("de-DE")}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  {req.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        onClick={() => handleApprove(req.id)}
                        size="sm"
                        className="h-8 bg-emerald-600 hover:bg-emerald-500 text-[11px]"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Genehmigen
                      </Button>
                      <Button
                        onClick={() => handleReject(req.id)}
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Ablehnen
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
