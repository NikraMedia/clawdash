"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { unwrapSessions } from "@/lib/gateway/unwrap";
import {
  Home,
  Clock,
  Activity,
  Settings,
  Plus,
  Search,
  MessageSquare,
  Bot,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  getSessionTitle,
  getTimeGroup,
  type TimeGroup,
} from "@/lib/session-utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/cron", label: "Cron", icon: Clock },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/system", label: "System", icon: Settings },
] as const;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const trpc = useTRPC();
  const [search, setSearch] = useState("");

  const { data: sessionsData, isLoading } = useQuery(
    trpc.sessions.list.queryOptions({
      includeDerivedTitles: true,
      includeLastMessage: true,
    })
  );

  const sessions = unwrapSessions(sessionsData);

  const filtered = useMemo(() => {
    let list = sessions;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          (s.label ?? "").toLowerCase().includes(q) ||
          (s.derivedTitle ?? "").toLowerCase().includes(q) ||
          (s.displayName ?? "").toLowerCase().includes(q) ||
          s.key.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [sessions, search]);

  const grouped = useMemo(() => {
    const groups: Record<TimeGroup, typeof filtered> = { Today: [], Yesterday: [], "This Week": [], Older: [] };
    filtered.forEach((s) => {
      groups[getTimeGroup(s.updatedAt)].push(s);
    });
    return groups;
  }, [filtered]);

  const groupOrder: TimeGroup[] = ["Today", "Yesterday", "This Week", "Older"];

  return (
    <>
      <div className="flex flex-col gap-3 p-4 border-b border-zinc-800/60 shrink-0">
        <Link
          href="/sessions"
          onClick={() => onNavigate?.()}
          className="flex h-10 w-full items-center justify-between rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white shadow-md transition-all hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
        >
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span>New Chat</span>
          </div>
          <Plus className="h-4 w-4 opacity-70" />
        </Link>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full bg-zinc-900/50 pl-8 text-sm border-zinc-800/80 placeholder:text-zinc-500 focus-visible:ring-1 focus-visible:ring-indigo-500/50 rounded-md shadow-inner transition-shadow"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-6 py-4">
          <div className="px-3">
            <h3 className="mb-2 px-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Main</h3>
            <nav className="flex flex-col gap-0.5">
              {navItems.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onNavigate?.()}
                    className={cn(
                      "group flex h-9 items-center gap-3 rounded-md px-2 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-zinc-800/80 text-zinc-50 shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-indigo-400" : "text-zinc-500")} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="px-3">
            <h3 className="mb-2 px-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Recent Chats</h3>
            <div className="flex flex-col">
              {isLoading && (
                <div className="p-4 text-center text-xs text-zinc-600">
                  Loading chats...
                </div>
              )}
              {!isLoading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-zinc-600">
                  <MessageSquare className="h-5 w-5 opacity-20" />
                  <p className="text-xs">No chats found</p>
                </div>
              )}
              {!isLoading && groupOrder.map((group) => {
                const items = grouped[group];
                if (items.length === 0) return null;
                return (
                  <div key={group} className="mb-4 last:mb-0">
                    <div className="px-2 pb-1.5 pt-2">
                      <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{group}</span>
                    </div>
                    <div className="flex flex-col gap-px">
                      {items.map((s) => {
                        const isActive = pathname === `/sessions/${encodeURIComponent(s.key)}`;
                        const title = getSessionTitle(s);

                        return (
                          <Link
                            key={s.key}
                            href={`/sessions/${encodeURIComponent(s.key)}`}
                            onClick={() => onNavigate?.()}
                            className={cn(
                              "group flex flex-col gap-0.5 rounded-md px-2 py-1.5 transition-all text-sm",
                              isActive
                                ? "bg-zinc-800/80 text-zinc-50 shadow-sm"
                                : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                            )}
                          >
                            <span className="truncate pr-2">{title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex h-full w-72 flex-col border-r border-zinc-800/80 bg-glass transition-all duration-200 shrink-0 overflow-hidden">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="md:hidden">
      <button 
        onClick={() => setOpen(true)} 
        className="mr-2 p-1.5 hover:bg-zinc-800 rounded-md transition-colors text-zinc-400 hover:text-zinc-100"
      >
        <Menu className="h-5 w-5" />
      </button>
      
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setOpen(false)} 
          />
          <aside className="relative flex w-72 h-full flex-col border-r border-zinc-800 bg-glass shadow-2xl animate-in slide-in-from-left-8 duration-300">
            <button 
              onClick={() => setOpen(false)} 
              className="absolute right-4 top-4 p-1.5 bg-zinc-900/50 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors z-50 border border-zinc-800/50"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
