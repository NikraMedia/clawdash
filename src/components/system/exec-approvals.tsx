"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { useTRPC } from "@/lib/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  approvalResolveTarget,
  normalizeApprovalsData,
} from "@/components/system/system-data";
import { useGatewayHealth } from "@/hooks/use-gateway-health";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "approved":
      return "border-emerald-500/25 bg-emerald-500/15 text-emerald-400";
    case "denied":
    case "rejected":
      return "border-red-500/25 bg-red-500/15 text-red-400";
    case "pending":
      return "border-amber-500/25 bg-amber-500/15 text-amber-400";
    default:
      return "border-zinc-700/80 bg-zinc-800/40 text-zinc-400";
  }
}

export function ExecApprovals() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { hasMethod } = useGatewayHealth();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    ...trpc.system.execApprovals.queryOptions(),
    refetchInterval: 5_000,
  });

  const approvals = useMemo(() => normalizeApprovalsData(data), [data]);

  const pendingApprovals = useMemo(
    () =>
      approvals
        .filter((approval) => approval.pending)
        .sort((a, b) => (a.requestedAtMs ?? 0) - (b.requestedAtMs ?? 0)),
    [approvals]
  );

  const recentResolved = useMemo(
    () =>
      approvals
        .filter((approval) => !approval.pending)
        .sort((a, b) => (b.resolvedAtMs ?? 0) - (a.resolvedAtMs ?? 0))
        .slice(0, 8),
    [approvals]
  );

  const resolveSupported = hasMethod("exec.approvals.resolve");

  const resolveMutation = useMutation(
    trpc.system.execApprovalsResolve.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.system.execApprovals.queryKey(),
        });
      },
    })
  );

  const resolveInFlightKey = useMemo(() => {
    if (!resolveMutation.isPending) return null;
    const payload = resolveMutation.variables;
    return payload?.id ?? payload?.sessionKey ?? null;
  }, [resolveMutation.isPending, resolveMutation.variables]);

  const handleResolve = (approvalKey: string, resolution: "approved" | "rejected") => {
    const approval = pendingApprovals.find((item) => item.key === approvalKey);
    if (!approval) return;

    const target = approvalResolveTarget(approval);
    if (!target) return;

    resolveMutation.mutate({
      ...target,
      resolution,
    });
  };

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return <QueryError error={error} label="execution approvals" onRetry={refetch} />;
  }

  if (approvals.length === 0) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No Approval Activity"
        description="No execution approval requests were returned by the gateway."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-xl border p-3 shadow-md backdrop-blur-sm",
          pendingApprovals.length > 0
            ? "border-amber-500/35 bg-amber-500/10"
            : "border-zinc-800/70 bg-zinc-900/40"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldAlert
              className={cn(
                "h-4 w-4",
                pendingApprovals.length > 0 ? "text-amber-400" : "text-indigo-400"
              )}
            />
            <span className="text-zinc-200">{pendingApprovals.length} pending approvals</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400">{approvals.length} total records</span>
            {isFetching && <span className="text-zinc-500">Refreshing...</span>}
          </div>

          {!resolveSupported && (
            <Badge className="border-red-500/25 bg-red-500/15 text-red-300">
              Gateway does not expose exec.approvals.resolve
            </Badge>
          )}
        </div>

        {resolveMutation.isError && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/25 bg-red-500/10 p-2 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{resolveMutation.error.message || "Failed to resolve approval request."}</p>
          </div>
        )}
      </div>

      {pendingApprovals.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Approval Queue Clear"
          description="No pending requests require operator action."
          className="min-h-[260px]"
        />
      ) : (
        <ScrollArea className="h-[calc(100vh-20rem)]">
          <div className="grid gap-3">
            {pendingApprovals.map((approval) => {
              const resolveTarget = approvalResolveTarget(approval);
              const canResolve = Boolean(resolveTarget) && resolveSupported;
              const requestIdentifier = approval.id ?? approval.sessionKey ?? approval.key;
              const isResolving =
                resolveMutation.isPending &&
                resolveInFlightKey !== null &&
                resolveInFlightKey === requestIdentifier;

              return (
                <Card
                  key={approval.key}
                  className="border-amber-500/25 bg-amber-500/[0.03] shadow-md backdrop-blur-sm"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-100">
                      <span className="truncate">{approval.toolName}</span>
                      <Badge className={statusBadgeClass(approval.status)}>{approval.status}</Badge>
                      {approval.agentId && (
                        <Badge
                          variant="outline"
                          className="border-zinc-700/80 bg-zinc-800/30 text-zinc-400"
                        >
                          {approval.agentId}
                        </Badge>
                      )}
                      <span className="ml-auto text-xs font-normal text-zinc-500">
                        {approval.requestedAtMs
                          ? formatRelativeTime(approval.requestedAtMs)
                          : "Unknown request time"}
                      </span>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2 text-xs text-zinc-400">
                      <p>{approval.summary ?? "No summary provided by gateway."}</p>
                      <p className="mt-1 font-mono text-[11px] text-zinc-500">
                        Request: {requestIdentifier}
                      </p>
                      {approval.requestedAtMs && (
                        <p className="mt-1 text-zinc-500">
                          Requested at {formatTimestamp(approval.requestedAtMs)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleResolve(approval.key, "approved")}
                        disabled={!canResolve || isResolving || resolveMutation.isPending}
                        className="bg-emerald-500/90 text-white hover:bg-emerald-400"
                      >
                        {isResolving ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Approve
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(approval.key, "rejected")}
                        disabled={!canResolve || isResolving || resolveMutation.isPending}
                        className="border-red-500/35 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Reject
                      </Button>

                      {!canResolve && (
                        <span className="text-xs text-zinc-500">
                          Unable to resolve: missing request id or gateway method
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {recentResolved.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900/40 shadow-md backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Recently Resolved
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-zinc-400">
            {recentResolved.map((approval) => (
              <div
                key={`resolved-${approval.key}`}
                className="flex flex-wrap items-center gap-2 border-b border-zinc-800/70 pb-2 last:border-0 last:pb-0"
              >
                <span className="truncate font-medium text-zinc-300">{approval.toolName}</span>
                <Badge className={statusBadgeClass(approval.status)}>{approval.status}</Badge>
                <span className="ml-auto text-zinc-500">
                  {approval.resolvedAtMs
                    ? formatRelativeTime(approval.resolvedAtMs)
                    : "Resolved"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
