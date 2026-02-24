"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Search, Wrench } from "lucide-react";
import { useTRPC } from "@/lib/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/ui/query-error";
import { ScrollArea } from "@/components/ui/scroll-area";
import { normalizeSkillsData } from "@/components/system/system-data";
import { cn } from "@/lib/utils";

export function SkillsList() {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery(
    trpc.agents.skills.queryOptions()
  );

  const skills = useMemo(() => normalizeSkillsData(data), [data]);

  const agentOptions = useMemo(() => {
    const options = new Set<string>();
    for (const skill of skills) {
      if (skill.agentId) options.add(skill.agentId);
    }
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [skills]);

  const filteredSkills = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return skills.filter((skill) => {
      if (agentFilter !== "all" && skill.agentId !== agentFilter) return false;

      if (!normalizedSearch) return true;

      return [skill.name, skill.id, skill.description, skill.agentId]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch));
    });
  }, [skills, search, agentFilter]);

  const pendingCount = useMemo(
    () => skills.filter((skill) => skill.enabled === false).length,
    [skills]
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
    return <QueryError error={error} label="agent skills" onRetry={refetch} />;
  }

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={Wrench}
        title="No Skills Reported"
        description="The gateway did not report any agent skills."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/40 p-3 shadow-md backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Wrench className="h-4 w-4 text-indigo-400" />
            <span>{skills.length} skills indexed</span>
            <span className="text-zinc-600">/</span>
            <span
              className={cn(
                pendingCount > 0 ? "text-amber-400" : "text-zinc-500"
              )}
            >
              {pendingCount} disabled
            </span>
          </div>

          <div className="relative w-full min-w-[220px] md:w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search skills"
              className="h-8 border-zinc-700 bg-zinc-950/60 pl-8 text-xs text-zinc-200"
              aria-label="Search skills"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={agentFilter === "all" ? "default" : "outline"}
            onClick={() => setAgentFilter("all")}
            className={cn(
              "h-7 px-2.5 text-xs",
              agentFilter === "all"
                ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                : "border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800"
            )}
          >
            All Agents
          </Button>

          {agentOptions.map((agentId) => (
            <Button
              key={agentId}
              type="button"
              size="sm"
              variant={agentFilter === agentId ? "default" : "outline"}
              onClick={() => setAgentFilter(agentId)}
              className={cn(
                "h-7 px-2.5 text-xs",
                agentFilter === agentId
                  ? "bg-indigo-500/90 text-white hover:bg-indigo-400"
                  : "border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800"
              )}
            >
              {agentId}
            </Button>
          ))}
        </div>
      </div>

      {filteredSkills.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No Matching Skills"
          description="Try a different search query or clear the selected agent filter."
          className="min-h-[260px]"
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSearch("");
                setAgentFilter("all");
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
            {filteredSkills.map((skill) => (
              <Card
                key={skill.key}
                className="border-zinc-800 bg-zinc-900/45 shadow-md backdrop-blur-sm"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-200">
                    <span className="truncate">{skill.name}</span>
                    {typeof skill.enabled === "boolean" && (
                      <Badge
                        className={cn(
                          "ml-auto",
                          skill.enabled
                            ? "border-emerald-500/25 bg-emerald-500/15 text-emerald-400"
                            : "border-amber-500/25 bg-amber-500/15 text-amber-400"
                        )}
                      >
                        {skill.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    )}
                    {skill.agentId && (
                      <Badge
                        variant="outline"
                        className="border-zinc-700/80 bg-zinc-800/40 text-zinc-400"
                      >
                        {skill.agentId}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <p className="text-xs leading-relaxed text-zinc-400">
                    {skill.description ?? "No description reported by the gateway."}
                  </p>

                  <div className="flex items-center justify-between gap-2 border-t border-zinc-800/70 pt-2">
                    <span className="truncate font-mono text-[11px] text-zinc-500">
                      {skill.id ?? skill.key}
                    </span>

                    {skill.id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(skill.id!, skill.key)}
                        className="h-6 px-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                        aria-label={`Copy skill id ${skill.id}`}
                      >
                        {copiedKey === skill.key ? (
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
