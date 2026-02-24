"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useTRPC } from "@/lib/trpc/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatUptime } from "@/lib/format";
import { cn } from "@/lib/utils";

const REQUIRED_METHODS = [
  "config.patch",
  "channels.status",
  "exec.approvals.get",
  "exec.approvals.resolve",
];

function DiagRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800/70 py-2.5 last:border-0">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <div className="text-right text-sm font-medium text-zinc-200">{children}</div>
    </div>
  );
}

export function GatewayDiagnostics() {
  const trpc = useTRPC();

  const { data, isLoading, isError, error, refetch } = useQuery({
    ...trpc.system.health.queryOptions(),
    refetchInterval: 5_000,
  });

  const snapshot = (data?.snapshot as Record<string, unknown> | undefined) ?? undefined;
  const uptimeMs = typeof snapshot?.uptimeMs === "number" ? snapshot.uptimeMs : undefined;

  const missingMethods = useMemo(() => {
    if (!data) return REQUIRED_METHODS;
    const methods = new Set(data.methods);
    return REQUIRED_METHODS.filter((method) => !methods.has(method));
  }, [data]);

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
    return <QueryError error={error} label="gateway diagnostics" onRetry={refetch} />;
  }

  if (!data) {
    return (
      <EmptyState
        icon={Activity}
        title="No Diagnostics Available"
        description="The gateway did not return a health snapshot."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-900/45 shadow-md backdrop-blur-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Gateway</p>
              <p className="mt-1 text-sm font-medium text-zinc-100">
                {data.connected ? "Connected" : "Disconnected"}
              </p>
            </div>
            {data.connected ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400" />
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/45 shadow-md backdrop-blur-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Server Version</p>
            <p className="mt-1 truncate text-sm font-medium text-zinc-100">
              {data.server?.version ?? "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/45 shadow-md backdrop-blur-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Uptime</p>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              {uptimeMs ? formatUptime(uptimeMs) : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/45 shadow-md backdrop-blur-sm">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Capabilities</p>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              {data.methods.length} methods / {data.events.length} events
            </p>
          </CardContent>
        </Card>
      </div>

      {missingMethods.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-300">Missing expected gateway methods</p>
            <p className="mt-1">
              {missingMethods.join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <Card className="border-zinc-800 bg-zinc-900/45 shadow-md backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Connection Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DiagRow label="Connection ID">
              <code className="font-mono text-xs text-zinc-400">
                {data.server?.connId ?? "-"}
              </code>
            </DiagRow>
            <DiagRow label="Auth Mode">
              <span className="capitalize">{String(snapshot?.authMode ?? "-")}</span>
            </DiagRow>
            <DiagRow label="State Version (presence)">
              {String((snapshot?.stateVersion as { presence?: number } | undefined)?.presence ?? "-")}
            </DiagRow>
            <DiagRow label="State Version (health)">
              {String((snapshot?.stateVersion as { health?: number } | undefined)?.health ?? "-")}
            </DiagRow>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/45 shadow-md backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300">
              Method And Event Catalog
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="methods" className="border-zinc-800/70">
                <AccordionTrigger className="py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:no-underline">
                  Methods
                  <Badge variant="outline" className="ml-1.5 border-zinc-700 bg-zinc-800/30 text-[10px] text-zinc-400">
                    {data.methods.length}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <ScrollArea className="max-h-44">
                    <div className="flex flex-wrap gap-1.5">
                      {data.methods.map((method) => (
                        <Badge
                          key={method}
                          variant="outline"
                          className={cn(
                            "border-zinc-700 bg-zinc-800/30 font-mono text-[10px] text-zinc-300",
                            REQUIRED_METHODS.includes(method) &&
                              "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          )}
                        >
                          {method}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="events" className="border-zinc-800/70">
                <AccordionTrigger className="py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:no-underline">
                  Events
                  <Badge variant="outline" className="ml-1.5 border-zinc-700 bg-zinc-800/30 text-[10px] text-zinc-400">
                    {data.events.length}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <ScrollArea className="max-h-44">
                    <div className="flex flex-wrap gap-1.5">
                      {data.events.map((eventName) => (
                        <Badge
                          key={eventName}
                          variant="outline"
                          className="border-zinc-700 bg-zinc-800/30 font-mono text-[10px] text-zinc-300"
                        >
                          {eventName}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
