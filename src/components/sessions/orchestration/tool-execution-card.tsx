import * as React from "react";
import { Wrench, CheckCircle2, ChevronRight, XCircle, Loader2 } from "lucide-react";
import { ToolCallPayload, ToolResultPayload } from "@/lib/normalize-content";
import { CodeBlock } from "@/components/ui/code-block";

interface Props {
    payload: ToolCallPayload | ToolResultPayload;
    type: "tool_call" | "tool_result";
}

function TruncatedOutput({ value, language }: { value: string; language: string }) {
    const [expanded, setExpanded] = React.useState(false);
    const lines = value.split("\n");
    const needsTruncation = lines.length > 8;

    if (!needsTruncation || expanded) {
        return (
            <div className="relative">
                <CodeBlock language={language} value={value} />
                {needsTruncation && (
                    <button
                        onClick={() => setExpanded(false)}
                        className="mt-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        Show less
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="relative overflow-hidden max-h-[120px]">
                <CodeBlock language={language} value={lines.slice(0, 6).join("\n")} />
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none" />
            </div>
            <button
                onClick={() => setExpanded(true)}
                className="mt-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
                Show {lines.length - 6} more lines
            </button>
        </div>
    );
}

export function ToolExecutionCard({ payload, type }: Props) {
    const [isOpen, setIsOpen] = React.useState(false);
    const isResult = type === "tool_result";
    const toolName = "toolName" in payload ? payload.toolName : undefined;
    const args = "arguments" in payload ? payload.arguments : undefined;
    const result = payload.result;
    const hasError = !!payload.error;
    const isPending = !isResult && !result;

    return (
        <div className="my-2 rounded-md border border-zinc-800/60 bg-zinc-950/40 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? `Collapse ${toolName || "tool"} details` : `Expand ${toolName || "tool"} details`}
                className="flex w-full items-center justify-between px-3 py-2 hover:bg-zinc-900/50 transition-colors text-left"
            >
                <div className="flex items-center gap-2.5">
                    {isResult ? (
                        hasError ? (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        )
                    ) : isPending ? (
                        <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                    ) : (
                        <Wrench className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span className="text-xs font-mono text-zinc-300">
                        {toolName || (isResult ? "Result" : "Tool")}
                    </span>
                    {isPending && (
                        <span className="text-[10px] text-amber-500/60 animate-pulse">running</span>
                    )}
                </div>
                <div className="text-zinc-600 transition-transform duration-200" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                    <ChevronRight className="h-3.5 w-3.5" />
                </div>
            </button>

            <div
                className="grid transition-all duration-200 ease-in-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
                <div className="overflow-hidden">
                    <div className="px-3 py-2.5 border-t border-zinc-800/60 flex flex-col gap-3">
                        {!isResult && args && Object.keys(args).length > 0 && (
                            <div>
                                <div className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider font-semibold">Inputs</div>
                                <TruncatedOutput language="json" value={JSON.stringify(args, null, 2)} />
                            </div>
                        )}

                        {isResult && result != null && (
                            <div>
                                <div className="text-[10px] text-zinc-500 mb-1.5 uppercase tracking-wider font-semibold">Output</div>
                                <TruncatedOutput
                                    language={typeof result === "string" ? "text" : "json"}
                                    value={typeof result === "string" ? result : JSON.stringify(result, null, 2)}
                                />
                            </div>
                        )}

                        {hasError && (
                            <div className="text-xs text-red-400 bg-red-950/20 p-2.5 border border-red-900/30 rounded-md">
                                {payload.error}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
