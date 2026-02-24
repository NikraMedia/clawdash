"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Radio, RefreshCcw } from "lucide-react";
import { useTRPC } from "@/lib/trpc/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { ScrollArea } from "@/components/ui/scroll-area";
import { normalizeChannelsData } from "@/components/system/system-data";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ChannelsStatus() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [lastProbeAt, setLastProbeAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    ...trpc.system.channels.queryOptions(),
    refetchInterval: 10_000,
  });

  const probeQuery = useQuery({
    ...trpc.system.channels.queryOptions({ probe: true }),
    enabled: false,
  });

  const PROBE_STALE_MS = 30_000;
  const probeIsStale =
    lastProbeAt === null || now - lastProbeAt > PROBE_STALE_MS;
  const sourceData =
    probeQuery.data && !probeIsStale ? probeQuery.data : data;

  const channels = useMemo(() => normalizeChannelsData(sourceData), [sourceData]);
  const disconnectedCount = useMemo(
    () => channels.filter((channel) => !channel.connected).length,
    [channels]
  );

  const probing = probeQuery.isFetching;

  async function handleProbe() {
    await probeQuery.refetch();
    await queryClient.invalidateQueries({
      queryKey: trpc.system.channels.queryKey(),
    });
    setLastProbeAt(Date.now());
  }

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

  if (isError && !probeQuery.data) {
    return <QueryError error={error} label="channel status" onRetry={refetch} />;
  }

  if (channels.length === 0) {
    return (
      <EmptyState
        icon={Radio}
        title="No Channels Configured"
        description="No channel status data was returned by the gateway."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleProbe}
            disabled={probing}
            className="border-zinc-700 bg-zinc-900/70 text-zinc-200"
          >
            {probing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Probe channels
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-3 shadow-md backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Radio className="h-4 w-4 text-indigo-400" />
            <span>{channels.length} total channels</span>
            <span className="text-zinc-600">/</span>
            <span
              className={cn(
                disconnectedCount > 0 ? "text-red-400" : "text-emerald-400"
              )}
            >
              {disconnectedCount} disconnected
            </span>
            {isFetching && <span className="text-zinc-600">Refreshing...</span>}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">
              Last probe: {lastProbeAt ? formatRelativeTime(lastProbeAt) : "Never"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleProbe}
              disabled={probing}
              aria-label="Probe all channels for connectivity status"
              className="border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              {probing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Probe Channels
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-20rem)]">
        <div className="grid gap-3 md:grid-cols-2">
          {channels.map((channel) => (
            <Card
              key={channel.key}
              className={cn(
                "border-zinc-800 bg-zinc-900/45 shadow-md backdrop-blur-sm",
                !channel.connected &&
                "border-red-500/40 bg-red-500/[0.03] ring-1 ring-inset ring-red-500/15"
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-200">
                  <span className="truncate">{channel.name}</span>
                  <Badge
                    className={cn(
                      "ml-auto",
                      channel.connected
                        ? "border-emerald-500/25 bg-emerald-500/15 text-emerald-400"
                        : "border-red-500/25 bg-red-500/15 text-red-400"
                    )}
                  >
                    {channel.connected ? "Connected" : "Disconnected"}
                  </Badge>

                  {channel.type && (
                    <Badge
                      variant="outline"
                      className="border-zinc-700/80 bg-zinc-800/40 text-zinc-400"
                    >
                      {channel.type}
                    </Badge>
                  )}
                  {channel.agentId && (
                    <Badge
                      variant="outline"
                      className="border-zinc-700/80 bg-zinc-800/40 text-zinc-400"
                    >
                      {channel.agentId}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-2 pt-0">
                {!channel.connected && (
                  <div className="flex items-start gap-2 rounded-md border border-red-500/25 bg-red-500/10 p-2 text-xs text-red-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>{channel.error ?? "Channel is not reporting a healthy status."}</p>
                  </div>
                )}

                {channel.connected && (
                  <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2 text-xs text-zinc-400">
                    Status: <span className="font-medium text-zinc-200">{channel.status}</span>
                  </div>
                )}

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="details" className="border-zinc-800/70">
                    <AccordionTrigger className="py-1 text-xs text-zinc-500 hover:text-zinc-300 hover:no-underline">
                      Channel Details
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      <div className="max-h-40 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/70 p-2">
                        <pre className="font-mono text-[10px] leading-relaxed text-zinc-400">
                          {JSON.stringify(channel.raw, null, 2)}
                        </pre>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
