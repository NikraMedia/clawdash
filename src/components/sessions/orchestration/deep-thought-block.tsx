import * as React from "react";
import { Brain, ChevronRight } from "lucide-react";
import { ThoughtPayload } from "@/lib/normalize-content";

interface Props {
    payload: ThoughtPayload;
}

export function DeepThoughtBlock({ payload }: Props) {
    const [isOpen, setIsOpen] = React.useState(false);
    const estimatedTokens = payload.tokenCountEstimate ?? Math.ceil(payload.rawText.length / 4);

    return (
        <div className="my-3 rounded-md border border-purple-900/30 bg-purple-950/10 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? "Collapse agent reasoning" : "Expand agent reasoning"}
                className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-purple-950/20 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-400/70" />
                    <span className="text-xs font-medium text-purple-300/80">Agent Reasoning</span>
                    <span className="text-[10px] text-zinc-600 tabular-nums">~{estimatedTokens.toLocaleString()} tokens</span>
                </div>
                <div className="text-zinc-500 transition-transform duration-200" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                    <ChevronRight className="h-4 w-4" />
                </div>
            </button>
            <div
                className="grid transition-all duration-200 ease-in-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
                <div className="overflow-hidden">
                    <div className="px-4 py-3 border-t border-purple-900/20 text-sm text-zinc-400/90 italic leading-relaxed break-words whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {payload.rawText}
                    </div>
                </div>
            </div>
        </div>
    );
}
