import { useState, useContext, useEffect } from "react";
import { Transcript } from "./transcript";
import { ConfigPanel } from "./config-panel";
import { OrchestrationPanel } from "./orchestration-panel";
import { InsightsPanel } from "./insights-panel";
import { Composer } from "./composer";
import { cn } from "@/lib/utils";
import { getSessionTitle } from "@/lib/session-utils";
import { formatTokens } from "@/lib/format";
import { SessionStreamContext } from "@/hooks/use-session-stream";
import { PanelRightClose, PanelRightOpen, Cpu, Wifi, WifiOff } from "lucide-react";
import type { SessionRow } from "@/lib/gateway/types";

export interface TranscriptMessage {
  role: string;
  content?: unknown;
  text?: string;
  ts?: number;
  /** Present on toolResult-role messages from the gateway */
  toolName?: string;
  /** Present on toolResult-role messages from the gateway */
  toolCallId?: string;
}

/** Session metadata provided to the workspace. All fields except `key` are optional
 *  because the session list may not have loaded yet when the workspace mounts. */
export type SessionMeta = Partial<SessionRow> & { key: string };

interface SessionWorkspaceProps {
  session: SessionMeta;
  messages: TranscriptMessage[];
  isLoadingMessages?: boolean;
}

const tabs = ["Insights", "Config", "Orchestration"] as const;
type Tab = (typeof tabs)[number];

export function SessionWorkspace({
  session,
  messages,
  isLoadingMessages,
}: SessionWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Insights");
  const [isContextVisible, setIsContextVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("claw-dash:context-panel");
    return stored !== "hidden";
  });

  useEffect(() => {
    localStorage.setItem("claw-dash:context-panel", isContextVisible ? "visible" : "hidden");
  }, [isContextVisible]);
  const streamCtx = useContext(SessionStreamContext);
  const isConnected = streamCtx?.state.connected ?? false;
  const isStreaming = streamCtx?.state.isStreaming ?? false;

  const title = getSessionTitle(session);

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-0 min-w-0 h-full w-full gap-0 overflow-hidden bg-zinc-950">
      {/* Transcript — left side */}
      <div className="flex flex-1 min-w-0 min-h-0 flex-col md:border-r border-zinc-800 transition-all duration-300">
        {/* Session Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-3 sm:px-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-950/50 text-indigo-400 ring-1 ring-indigo-900/50">
              <Cpu className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <h2 className="text-sm font-semibold text-zinc-100 truncate leading-tight">
                {title}
              </h2>
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                {session.model && (
                  <span className="font-mono">{session.model}</span>
                )}
                {session.model && session.thinkingLevel && (
                  <span className="text-zinc-700">\u00b7</span>
                )}
                {session.thinkingLevel && (
                  <span>thinking: {session.thinkingLevel}</span>
                )}
                {session.totalTokens ? (
                  <>
                    <span className="text-zinc-700">\u00b7</span>
                    <span className="tabular-nums">{formatTokens(session.totalTokens)} tokens</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
              isStreaming
                ? "text-indigo-400 bg-indigo-500/10"
                : isConnected
                  ? "text-emerald-500/70 bg-emerald-500/5"
                  : "text-zinc-500 bg-zinc-800/50"
            )}>
              {isStreaming ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400" />
                  </span>
                  Streaming
                </>
              ) : isConnected ? (
                <>
                  <Wifi className="h-3 w-3" />
                  Live
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Polling
                </>
              )}
            </div>
            <button
              onClick={() => setIsContextVisible(!isContextVisible)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
              title={isContextVisible ? "Hide panel" : "Show panel"}
              aria-label={isContextVisible ? "Hide context panel" : "Show context panel"}
            >
              {isContextVisible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 relative">
          <Transcript messages={messages} isLoading={isLoadingMessages} sessionKey={session.key} />
        </div>
        <Composer sessionKey={session.key} />
      </div>

      {/* Context panel — right side */}
      <div
        className={cn(
          "shrink-0 flex-col min-h-0 bg-zinc-900/30 transition-all duration-300 ease-in-out border-l border-zinc-800/0 hidden md:flex",
          isContextVisible ? "w-80 opacity-100" : "w-0 opacity-0 overflow-hidden border-none"
        )}
      >
        {/* Tabs */}
        <div className="flex h-10 items-center border-b border-zinc-800 bg-zinc-900/50 px-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                activeTab === tab
                  ? "bg-zinc-800 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto min-h-0">
          {activeTab === "Insights" && (
            <InsightsPanel
              session={session}
              messages={messages}
              isStreaming={isStreaming}
              streamContent={streamCtx?.state.streamingContent}
            />
          )}
          {activeTab === "Config" && <ConfigPanel session={session} />}
          {activeTab === "Orchestration" && (
            <OrchestrationPanel
              spawnedBy={session.spawnedBy}
              spawnDepth={session.spawnDepth}
              sessionKey={session.key}
              messages={messages}
            />
          )}
        </div>
      </div>
    </div>
  );
}
