"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { unwrapCronJobs, unwrapSessions } from "@/lib/gateway/unwrap";
import { getSessionTitle } from "@/lib/session-utils";
import {
  Home,
  MessageSquare,
  Clock,
  Activity,
  Settings,
  Play,
  ToggleLeft,
  ToggleRight,
  Plus,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: agentsData } = useQuery({
    ...trpc.agents.list.queryOptions(),
    enabled: open,
  });

  const { data: cronData } = useQuery({
    ...trpc.cron.list.queryOptions({ includeDisabled: true }),
    enabled: open,
  });

  const { data: sessionsData } = useQuery({
    ...trpc.sessions.list.queryOptions({
      limit: 20,
      includeDerivedTitles: true,
      includeLastMessage: true,
    }),
    enabled: open,
  });

  const cronRunMutation = useMutation(
    trpc.cron.run.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cron.list.queryKey() });
      },
      onError: (err) => {
        console.error("[claw-dash] Cron run failed:", err.message);
      },
    })
  );

  const cronToggleMutation = useMutation(
    trpc.cron.toggle.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.cron.list.queryKey() });
      },
      onError: (err) => {
        console.error("[claw-dash] Cron toggle failed:", err.message);
      },
    })
  );

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  const runCronJob = useCallback(
    (id: string) => {
      setOpen(false);
      cronRunMutation.mutate({ id, mode: "force" });
    },
    [cronRunMutation]
  );

  const toggleCronJob = useCallback(
    (id: string, currentlyEnabled: boolean) => {
      setOpen(false);
      cronToggleMutation.mutate({ id, enabled: !currentlyEnabled });
    },
    [cronToggleMutation]
  );

  const agents = agentsData?.agents ?? [];
  const cronJobs = unwrapCronJobs(cronData);
  const sessions = unwrapSessions(sessionsData);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands, agents, sessions, cron jobs..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate("/")}>
            <Home className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
            Go to Home
          </CommandItem>
          <CommandItem onSelect={() => navigate("/agents")}>
            <Home className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
            Go to Agents
          </CommandItem>
          <CommandItem onSelect={() => navigate("/sessions")}>
            <MessageSquare className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
            Go to Sessions
          </CommandItem>
          <CommandItem onSelect={() => navigate("/memory")}>
            <Home className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
            Go to Memory
          </CommandItem>
          <CommandItem onSelect={() => navigate("/permissions")}>
            <Home className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
            Go to Permissions
          </CommandItem>
          <CommandItem onSelect={() => navigate("/costs")}>
            <Home className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
            Go to Costs
          </CommandItem>
          <CommandItem onSelect={() => navigate("/cron")}>
            <Clock className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
            Go to Cron
          </CommandItem>
          <CommandItem onSelect={() => navigate("/activity")}>
            <Activity className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
            Go to Activity
          </CommandItem>
          <CommandItem onSelect={() => navigate("/system")}>
            <Settings className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
            Go to System
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => navigate("/sessions")}>
            <Plus className="mr-2 h-4 w-4 shrink-0 text-emerald-400" />
            New session
          </CommandItem>
          {cronJobs.map((j) => (
            <CommandItem key={`run-${j.id}`} onSelect={() => runCronJob(j.id)}>
              <Play className="mr-2 h-4 w-4 shrink-0 text-amber-400" />
              Run cron job: {j.name}
            </CommandItem>
          ))}
          {cronJobs.map((j) => (
            <CommandItem
              key={`toggle-${j.id}`}
              onSelect={() => toggleCronJob(j.id, j.enabled)}
            >
              {j.enabled ? (
                <ToggleRight className="mr-2 h-4 w-4 shrink-0 text-sky-400" />
              ) : (
                <ToggleLeft className="mr-2 h-4 w-4 shrink-0 text-zinc-500" />
              )}
              {j.enabled ? "Disable" : "Enable"} cron job: {j.name}
            </CommandItem>
          ))}
        </CommandGroup>

        {agents.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Chat with Agent">
              {agents.map((a) => (
                <CommandItem
                  key={`chat-${a.id}`}
                  onSelect={() => navigate(`/sessions?agent=${a.id}`)}
                >
                  <MessageSquare className="mr-2 h-4 w-4 shrink-0 text-indigo-400" />
                  Chat with {a.name ?? a.id}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="View Memory">
              {agents.map((a) => (
                <CommandItem
                  key={`mem-${a.id}`}
                  onSelect={() => navigate(`/memory?agent=${a.id}`)}
                >
                  {a.emoji ? `${a.emoji} ` : ""}
                  View Memory: {a.name ?? a.id}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Agents">
              <CommandItem onSelect={() => navigate("/agents")}>
                Open Roundtable
              </CommandItem>
              {agents.map((a) => (
                <CommandItem
                  key={a.id}
                  onSelect={() => navigate(`/sessions?agent=${a.id}`)}
                >
                  {a.emoji ? `${a.emoji} ` : ""}
                  {a.name ?? a.id}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {sessions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Sessions">
              {sessions.slice(0, 8).map((s) => (
                <CommandItem
                  key={s.key}
                  onSelect={() =>
                    navigate(`/sessions/${encodeURIComponent(s.key)}`)
                  }
                >
                  {getSessionTitle(s)}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {cronJobs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Cron Jobs">
              {cronJobs.slice(0, 10).map((j) => (
                <CommandItem
                  key={j.id}
                  onSelect={() => navigate(`/cron?job=${j.id}`)}
                >
                  {j.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
