"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Brain,
  Search,
  RefreshCw,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AGENTS = [
  { id: "manager", name: "Manager", emoji: "🤖", dept: "main" },
  { id: "steve", name: "Steve", emoji: "👔", dept: "ceo" },
  { id: "gary", name: "Gary", emoji: "📢", dept: "marketing" },
  { id: "jimmy", name: "Jimmy", emoji: "✍️", dept: "content" },
  { id: "neil", name: "Neil", emoji: "🔍", dept: "seo" },
  { id: "nate", name: "Nate", emoji: "📊", dept: "analytics" },
  { id: "alex", name: "Alex", emoji: "💰", dept: "sales" },
  { id: "warren", name: "Warren", emoji: "🏦", dept: "finance" },
  { id: "tom", name: "Tom", emoji: "📋", dept: "tax" },
  { id: "robert", name: "Robert", emoji: "⚖️", dept: "legal" },
  { id: "tiago", name: "Tiago", emoji: "📝", dept: "notion-systems" },
  { id: "pieter", name: "Pieter", emoji: "💻", dept: "tech" },
];

export default function MemoryPage() {
  const [selectedAgent, setSelectedAgent] = useState<string>("manager");
  const [search, setSearch] = useState("");
  const [syncingAll, setSyncingAll] = useState(false);
  const trpc = useTRPC();

  // Fetch memory for selected agent
  const { data, isLoading, refetch } = useQuery({
    ...trpc.memory.getAgentMemory.queryOptions({ agentId: selectedAgent }),
    refetchInterval: 30000,
  });

  // Fetch all memories for search
  const memoryQueries = AGENTS.map((agent) => ({
    id: agent.id,
    name: agent.name,
    emoji: agent.emoji,
    query: useQuery({
      ...trpc.memory.getAgentMemory.queryOptions({ agentId: agent.id }),
      refetchInterval: 60000,
    }),
  }));

  // Search results
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return memoryQueries
      .filter((mq) => {
        const content = mq.query.data?.content;
        return content && content.toLowerCase().includes(q);
      })
      .map((mq) => ({
        id: mq.id,
        name: mq.name,
        emoji: mq.emoji,
        snippet: getSnippet(mq.query.data?.content ?? "", q),
      }));
  }, [search, memoryQueries]);

  const syncMutation = useMutation(
    trpc.memory.syncAgent.mutationOptions({
      onSuccess: () => setTimeout(() => refetch(), 2000),
    })
  );

  const handleSyncAll = async () => {
    setSyncingAll(true);
    for (const agent of AGENTS) {
      try {
        await syncMutation.mutateAsync({ agentId: agent.id });
        // Small delay between syncs
        await new Promise((r) => setTimeout(r, 500));
      } catch {
        // continue with next
      }
    }
    setSyncingAll(false);
  };

  const selected = AGENTS.find((a) => a.id === selectedAgent) ?? AGENTS[0];

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left sidebar - Agent list */}
      <div className="w-64 shrink-0 flex flex-col border-r border-zinc-800/80 bg-zinc-950/50">
        <div className="px-4 py-4 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-400" />
              <h1 className="text-sm font-semibold text-zinc-100">Agent Memory</h1>
            </div>
            <Button
              onClick={handleSyncAll}
              disabled={syncingAll}
              size="sm"
              className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-500"
            >
              {syncingAll ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Sync All
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Memories durchsuchen..."
              className="w-full bg-zinc-900 border border-zinc-700/60 rounded-lg pl-8 pr-8 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {/* Search results view */}
          {search.trim() ? (
            <div className="p-2 space-y-1">
              <p className="text-[10px] text-zinc-500 px-2 py-1">
                {searchResults.length} Treffer
              </p>
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedAgent(r.id);
                    setSearch("");
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{r.emoji}</span>
                    <span className="text-xs text-zinc-200 font-medium">
                      {r.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">
                    {r.snippet}
                  </p>
                </button>
              ))}
              {searchResults.length === 0 && (
                <p className="text-[11px] text-zinc-600 text-center py-4">
                  Nichts gefunden
                </p>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {AGENTS.map((agent) => {
                const isActive = selectedAgent === agent.id;
                const mq = memoryQueries.find((m) => m.id === agent.id);
                const hasMemory = mq?.query.data?.exists;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all",
                      isActive
                        ? "bg-zinc-800/80 text-zinc-100"
                        : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                    )}
                  >
                    <span className="text-base">{agent.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {agent.name}
                      </p>
                    </div>
                    {hasMemory ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-zinc-700 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right content - Memory viewer */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">{selected.emoji}</span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                {selected.name}
              </h2>
              <p className="text-[10px] text-zinc-500">
                {data?.lastModified
                  ? `Zuletzt geändert: ${new Date(data.lastModified).toLocaleString("de-DE")}`
                  : "Kein Memory vorhanden"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() =>
                syncMutation.mutate({ agentId: selectedAgent })
              }
              disabled={syncMutation.isPending}
              variant="ghost"
              size="sm"
              className="h-8 text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Sync
            </Button>
            <Button
              onClick={() => refetch()}
              variant="ghost"
              size="sm"
              className="h-8 text-[11px] text-zinc-400"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
            </div>
          ) : data?.exists ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {data.content ?? ""}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Brain className="h-12 w-12 text-zinc-700 mb-4" />
              <p className="text-sm text-zinc-500">
                Kein Memory für {selected.name}
              </p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Klick &quot;Sync&quot; um Memory zu erstellen
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getSnippet(content: string, query: string): string {
  const idx = content.toLowerCase().indexOf(query);
  if (idx === -1) return content.slice(0, 100);
  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + query.length + 60);
  return (start > 0 ? "..." : "") + content.slice(start, end) + (end < content.length ? "..." : "");
}
