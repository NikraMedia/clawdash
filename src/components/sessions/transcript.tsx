"use client";

import { useEffect, useRef, useContext, useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CodeBlock } from "@/components/ui/code-block";
import { Cpu, Terminal, Copy, Check, ArrowDown, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionStreamContext } from "@/hooks/use-session-stream";
import { parseEvents, ParsedEvent, DelegationPayload, ThoughtPayload, ToolCallPayload, ToolResultPayload, ApprovalPayload } from "@/lib/normalize-content";
import { SubAgentDelegationBlock } from "@/components/sessions/orchestration/sub-agent-delegation-block";
import { DeepThoughtBlock } from "@/components/sessions/orchestration/deep-thought-block";
import { ToolExecutionCard } from "@/components/sessions/orchestration/tool-execution-card";
import { HitlApprovalCard } from "@/components/sessions/orchestration/hitl-approval-card";
import { UnknownPayloadCard } from "@/components/sessions/orchestration/unknown-payload-card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TranscriptMessage } from "./session-workspace";

interface TranscriptProps {
  messages: TranscriptMessage[];
  isLoading?: boolean;
  sessionKey?: string;
}

import type { Components } from "react-markdown";

function MarkdownContent({ content }: { content: string }) {
  if (!content) return <span className="text-zinc-600 italic">empty</span>;

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const components: Components = {
    code({ className, children, node, ref, ...rest }) {
      const match = /language-(\w+)/.exec(className || "");
      if (match) {
        return (
          <div className="my-4">
            <CodeBlock language={match[1]} value={String(children).replace(/\n$/, "")} />
          </div>
        );
      }
      return (
        <code className={cn("bg-zinc-800/80 rounded mt-0.5 px-1.5 py-0.5 text-zinc-200 font-mono text-[0.85em]", className)} {...rest}>
          {children}
        </code>
      );
    },
    a: ({ node, ref, ...rest }) => (
      <a className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors" target="_blank" rel="noreferrer" {...rest} />
    ),
    table: ({ node, ref, ...rest }) => (
      <div className="my-4 w-full overflow-x-auto rounded-md border border-zinc-800">
        <table className="w-full text-sm text-left text-zinc-300" {...rest} />
      </div>
    ),
    thead: ({ node, ref, ...rest }) => <thead className="text-xs uppercase bg-zinc-900/50 text-zinc-400 border-b border-zinc-800" {...rest} />,
    th: ({ node, ref, ...rest }) => <th className="px-4 py-3 font-medium" {...rest} />,
    td: ({ node, ref, ...rest }) => <td className="px-4 py-3 border-b border-zinc-800/50 last:border-0" {...rest} />,
    p: ({ node, ref, ...rest }) => <p className="mb-4 leading-relaxed last:mb-0" {...rest} />,
    ul: ({ node, ref, ...rest }) => <ul className="list-disc pl-6 mb-4 last:mb-0 space-y-1" {...rest} />,
    ol: ({ node, ref, ...rest }) => <ol className="list-decimal pl-6 mb-4 last:mb-0 space-y-1" {...rest} />,
    li: ({ node, ref, ...rest }) => <li className="pl-1 leading-relaxed" {...rest} />,
    h1: ({ node, ref, ...rest }) => <h1 className="text-xl font-bold mb-4 mt-6 first:mt-0 text-zinc-100" {...rest} />,
    h2: ({ node, ref, ...rest }) => <h2 className="text-lg font-bold mb-3 mt-6 first:mt-0 text-zinc-100" {...rest} />,
    h3: ({ node, ref, ...rest }) => <h3 className="text-base font-semibold mb-3 mt-4 first:mt-0 text-zinc-200" {...rest} />,
    h4: ({ node, ref, ...rest }) => <h4 className="text-sm font-semibold mb-2 mt-4 first:mt-0 text-zinc-200" {...rest} />,
    blockquote: ({ node, ref, ...rest }) => <blockquote className="border-l-2 border-zinc-700 pl-4 italic text-zinc-400 mb-4" {...rest} />,
    hr: ({ node, ref, ...rest }) => <hr className="border-zinc-800 my-6" {...rest} />,
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */

  return (
    <div className="max-w-none break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Merge consecutive text events into a single event so that markdown
 * context (headings, code fences, lists) is preserved across content blocks.
 * The gateway may store SSE delta fragments as individual content blocks,
 * which breaks markdown rendering when each is rendered separately.
 */
function mergeConsecutiveTextEvents(events: ParsedEvent[]): ParsedEvent[] {
  const merged: ParsedEvent[] = [];
  for (const event of events) {
    const prev = merged.length > 0 ? merged[merged.length - 1] : null;
    if (event.type === "text" && prev?.type === "text") {
      merged[merged.length - 1] = {
        ...prev,
        payload: String(prev.payload) + String(event.payload),
      };
    } else {
      merged.push(event);
    }
  }
  return merged;
}

function EventRenderer({ event, sessionKey }: { event: ParsedEvent; sessionKey?: string }) {
  switch (event.type) {
    case "text":
      return <MarkdownContent content={String(event.payload)} />;
    case "thought":
      return <DeepThoughtBlock payload={event.payload as ThoughtPayload} />;
    case "tool_call":
    case "tool_result":
      return (
        <ToolExecutionCard
          payload={event.payload as ToolCallPayload | ToolResultPayload}
          type={event.type as "tool_call" | "tool_result"}
        />
      );
    case "delegation": {
      const delPayload = event.payload as DelegationPayload;
      return (
        <SubAgentDelegationBlock payload={delPayload}>
          {delPayload.nestedEvents && delPayload.nestedEvents.length > 0 && (
            delPayload.nestedEvents.map((nested) => (
              <EventRenderer key={nested.id} event={nested} sessionKey={sessionKey} />
            ))
          )}
        </SubAgentDelegationBlock>
      );
    }
    case "approval":
      return <HitlApprovalCard payload={event.payload as ApprovalPayload} sessionKey={sessionKey} />;
    case "unknown":
    default:
      return <UnknownPayloadCard payload={event.payload} />;
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="text-zinc-600 hover:text-zinc-300 transition-all ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
      aria-label="Copy message"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Staggered pulse dots for thinking/loading states */
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-4 px-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="block h-2 w-2 rounded-full bg-zinc-500"
          style={{
            animation: "pulse 1.4s ease-in-out infinite",
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function Transcript({ messages, isLoading, sessionKey }: TranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const streamCtx = useContext(SessionStreamContext);
  const streamState = streamCtx?.state;
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Deduplicate messages that share the same role + timestamp + content
  // This prevents multiple sends from displaying duplicate entries
  const dedupedMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((msg) => {
      let contentKey: string;
      try {
        contentKey = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      } catch {
        contentKey = String(msg.content);
      }
      const key = `${msg.role}:${msg.ts ?? ""}:${contentKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [messages]);

  useEffect(() => {
    if (!bottomRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsAtBottom(entry.isIntersecting);
      },
      { root: null, rootMargin: "0px", threshold: 0 }
    );
    observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, []);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [dedupedMessages.length, streamState?.streamingContent, isAtBottom]);

  return (
    <div className="relative h-full w-full">
      <ScrollArea className="h-full" ref={scrollAreaRef}>
        <div className="flex flex-col mx-auto max-w-3xl pb-8 pt-24 px-4">
          {isLoading && dedupedMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex items-center gap-1.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="block h-1.5 w-1.5 rounded-full bg-zinc-600"
                    style={{
                      animation: "pulse 1.4s ease-in-out infinite",
                      animationDelay: `${delay}ms`,
                    }}
                  />
                ))}
              </div>
              <p className="text-xs text-zinc-600">Loading transcript...</p>
            </div>
          )}
          {!isLoading && dedupedMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900/50 ring-1 ring-zinc-800">
                <Cpu className="h-6 w-6 text-zinc-600" />
              </div>
              <div className="text-center">
                <p className="text-sm text-zinc-400 font-medium">No messages yet</p>
                <p className="text-xs text-zinc-600 mt-1">Send a message below to start the conversation.</p>
              </div>
            </div>
          )}
          {dedupedMessages.map((msg, i) => {
            const isUser = msg.role === "user";
            const isSystem = msg.role === "system";
            const isToolResult = msg.role === "toolResult";

            // For toolResult role messages, synthesize a tool_result event
            // Gateway sends these as top-level messages with toolCallId, toolName, content
            if (isToolResult) {
              const toolName = msg.toolName;
              const toolCallId = msg.toolCallId ?? `result-${i}`;
              const resultContent = msg.content;
              // Extract text from content array if present
              let resultText: unknown = resultContent;
              if (Array.isArray(resultContent)) {
                const textParts = resultContent
                  .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null && (b as Record<string, unknown>).type === "text")
                  .map(b => b.text);
                resultText = textParts.length === 1 ? textParts[0] : textParts.join("\n");
              }
              return (
                <div
                  key={`${msg.role}-${msg.ts ?? i}-${i}`}
                  className="group flex gap-3.5 py-1 px-2 animate-in fade-in duration-200"
                >
                  <div className="shrink-0 mt-1 w-7" />
                  <div className="min-w-0 flex-1">
                    <ToolExecutionCard
                      payload={{
                        toolName,
                        toolUseId: toolCallId,
                        result: resultText,
                      } as ToolResultPayload}
                      type="tool_result"
                    />
                  </div>
                </div>
              );
            }

            const rawPayload = msg.content ?? msg.text;
            const events = mergeConsecutiveTextEvents(
              parseEvents(rawPayload, msg.ts ? String(msg.ts) : `msg-${i}`)
            );

            let rawTextForCopy = "";
            try {
              rawTextForCopy = typeof rawPayload === "string" ? rawPayload : JSON.stringify(rawPayload, null, 2);
            } catch {
              rawTextForCopy = "Unable to stringify content";
            }

            // User messages: right-aligned with pill background
            if (isUser) {
              return (
                <div
                  key={`${msg.role}-${msg.ts ?? i}-${i}`}
                  className="group flex justify-end py-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
                >
                  <div className="flex flex-col items-end gap-1 max-w-[85%]">
                    <div className="rounded-2xl rounded-br-md bg-zinc-800/80 px-4 py-3 text-sm text-zinc-200 break-words">
                      {events.length === 0 ? (
                        <span className="text-zinc-600 italic">empty</span>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {events.map((event) => (
                            <EventRenderer key={event.id} event={event} sessionKey={sessionKey} />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      {msg.ts && (
                        <span className="text-[10px] text-zinc-600 tabular-nums">
                          {new Date(msg.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                      <CopyButton text={rawTextForCopy} />
                    </div>
                  </div>
                </div>
              );
            }

            // System messages: compact, muted
            if (isSystem) {
              return (
                <div
                  key={`${msg.role}-${msg.ts ?? i}-${i}`}
                  className="group flex gap-3 py-2 px-2 animate-in fade-in duration-200"
                >
                  <div className="shrink-0 mt-0.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-950/40 text-amber-600 ring-1 ring-amber-900/40">
                      <Terminal className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-zinc-500 break-words opacity-70">
                      {events.length === 0 ? (
                        <span className="text-zinc-600 italic">empty</span>
                      ) : (
                        events.map((event) => (
                          <EventRenderer key={event.id} event={event} sessionKey={sessionKey} />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // Assistant messages: left-aligned, no background, with avatar
            return (
              <div
                key={`${msg.role}-${msg.ts ?? i}-${i}`}
                className="group flex gap-3.5 py-5 animate-in fade-in slide-in-from-bottom-2 duration-200"
              >
                <div className="shrink-0 mt-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-950/50 text-indigo-400 ring-1 ring-indigo-900/40">
                    <Cpu className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-400/80">Assistant</span>
                    {msg.ts && (
                      <span className="text-[10px] text-zinc-600 tabular-nums">
                        {new Date(msg.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                    <CopyButton text={rawTextForCopy} />
                  </div>
                  <div className="text-sm text-zinc-300 break-words flex flex-col gap-3 leading-relaxed">
                    {events.length === 0 ? (
                      <span className="text-zinc-600 italic">empty</span>
                    ) : (
                      events.map((event) => (
                        <EventRenderer key={event.id} event={event} sessionKey={sessionKey} />
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Stream Error Banner */}
          {streamState?.error && !streamState?.isStreaming && (
            <div className="mx-2 mb-4 flex items-start gap-3 rounded-lg border border-red-900/30 bg-red-950/20 p-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-red-400">Stream Error</p>
                <p className="text-xs text-red-400/70 mt-0.5">{streamState.error}</p>
              </div>
              <button
                onClick={() => streamCtx?.dispatch({ type: "RESET" })}
                className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Streaming Message Bubble */}
          {streamState?.isStreaming && (
            <div className="group flex gap-3.5 py-5 animate-in fade-in duration-300">
              <div className="shrink-0 mt-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-950/50 text-indigo-400 ring-1 ring-indigo-900/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]">
                  <Cpu className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-indigo-400/80">Assistant</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-indigo-400/60 font-medium">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400" />
                    </span>
                    Streaming
                  </span>
                </div>
                <div className="text-sm text-zinc-300 break-words flex flex-col gap-3 leading-relaxed">
                  {streamState.streamingContent ? (
                    <div className="max-w-none">
                      <MarkdownContent content={streamState.streamingContent} />
                      <span className="inline-block w-[3px] h-[1.1em] ml-0.5 bg-indigo-400/70 animate-pulse align-text-bottom rounded-sm" />
                    </div>
                  ) : (
                    <ThinkingDots />
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-4 w-full" />
        </div>
      </ScrollArea>

      {!isAtBottom && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-2 rounded-full bg-zinc-800/95 backdrop-blur-sm border border-zinc-700/80 px-4 py-2 text-xs font-semibold text-zinc-200 shadow-xl hover:bg-zinc-700 hover:text-white transition-all hover:scale-105 active:scale-95"
          >
            <ArrowDown className="h-4 w-4" />
            Scroll to bottom
          </button>
        </div>
      )}
    </div>
  );
}
