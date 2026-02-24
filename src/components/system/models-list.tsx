"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Check, Copy, Search } from "lucide-react";
import { useTRPC } from "@/lib/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/ui/query-error";
import { ScrollArea } from "@/components/ui/scroll-area";
import { normalizeModelsData } from "@/components/system/system-data";
import { formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ModelsList() {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery(
    trpc.system.models.queryOptions()
  );

  const models = useMemo(() => normalizeModelsData(data), [data]);

  const providerOptions = useMemo(() => {
    const options = new Set<string>();
    for (const model of models) {
      if (model.provider) options.add(model.provider);
    }
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [models]);

  const filteredModels = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return models.filter((model) => {
      if (providerFilter !== "all" && model.provider !== providerFilter) {
        return false;
      }

      if (!normalizedSearch) return true;

      const searchable = [
        model.name,
        model.id,
        model.provider,
        model.type,
        model.capabilities.join(" "),
      ].filter((value): value is string => Boolean(value));

      return searchable.some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [models, providerFilter, search]);

  const defaultCount = useMemo(
    () => models.filter((model) => model.default).length,
    [models]
  );

  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1200);
    } catch {
      setCopiedKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return <QueryError error={error} label="models catalog" onRetry={refetch} />;
  }

  if (models.length === 0) {
    return (
      <EmptyState
        icon={Box}
        title="No Models Found"
        description="The gateway did not return any model metadata."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-3 shadow-md backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Box className="h-4 w-4 text-indigo-400" />
            <span>{models.length} models available</span>
            <span className="text-zinc-600">/</span>
            <span className={defaultCount > 0 ? "text-emerald-400" : "text-zinc-500"}>
              {defaultCount} default
            </span>
          </div>

          <div className="relative w-full min-w-[220px] md:w-[300px]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search models"
              className="h-8 border-zinc-700 bg-zinc-950/60 pl-8 text-xs text-zinc-200"
              aria-label="Search models"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={providerFilter === "all" ? "default" : "outline"}
            onClick={() => setProviderFilter("all")}
            className={cn(
              "h-7 px-2.5 text-xs",
              providerFilter === "all"
                ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                : "border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800"
            )}
          >
            All Providers
          </Button>

          {providerOptions.map((provider) => (
            <Button
              key={provider}
              type="button"
              size="sm"
              variant={providerFilter === provider ? "default" : "outline"}
              onClick={() => setProviderFilter(provider)}
              className={cn(
                "h-7 px-2.5 text-xs",
                providerFilter === provider
                  ? "bg-indigo-500/90 text-white hover:bg-indigo-400"
                  : "border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800"
              )}
            >
              {provider}
            </Button>
          ))}
        </div>
      </div>

      {filteredModels.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No Matching Models"
          description="Try a different search query or clear the provider filter."
          className="min-h-[260px]"
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSearch("");
                setProviderFilter("all");
              }}
              className="border-zinc-700 bg-zinc-900/70 text-zinc-200"
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <ScrollArea className="h-[calc(100vh-20rem)]">
          <div className="grid gap-3 md:grid-cols-2">
            {filteredModels.map((model) => (
              <Card
                key={model.key}
                className="border-zinc-800 bg-zinc-900/45 shadow-md backdrop-blur-sm"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-200">
                    <span className="truncate">{model.name}</span>
                    {model.default && (
                      <Badge className="ml-auto border-emerald-500/25 bg-emerald-500/15 text-emerald-400">
                        Default
                      </Badge>
                    )}
                    {model.provider && (
                      <Badge
                        variant="outline"
                        className="border-zinc-700/80 bg-zinc-800/40 text-zinc-400"
                      >
                        {model.provider}
                      </Badge>
                    )}
                    {model.type && (
                      <Badge
                        variant="outline"
                        className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                      >
                        {model.type}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2">
                      <p className="text-zinc-500">Context Window</p>
                      <p className="mt-0.5 font-medium text-zinc-200">
                        {model.contextWindow ? formatTokens(model.contextWindow) : "-"}
                      </p>
                    </div>
                    <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-2">
                      <p className="text-zinc-500">Max Output</p>
                      <p className="mt-0.5 font-medium text-zinc-200">
                        {model.maxOutput ? formatTokens(model.maxOutput) : "-"}
                      </p>
                    </div>
                  </div>

                  <div className="flex min-h-8 flex-wrap gap-1.5">
                    {model.capabilities.length > 0 ? (
                      model.capabilities.map((capability) => (
                        <Badge
                          key={`${model.key}-${capability}`}
                          className="border-blue-500/25 bg-blue-500/10 text-[10px] text-blue-300"
                        >
                          {capability}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-500">
                        No capability tags reported
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-2">
                    <span className="truncate font-mono text-[11px] text-zinc-500">
                      {model.id ?? model.key}
                    </span>

                    {model.id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(model.id!, model.key)}
                        className="h-6 px-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                        aria-label={`Copy model id ${model.id}`}
                      >
                        {copiedKey === model.key ? (
                          <>
                            <Check className="mr-1 h-3.5 w-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Copy ID
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
