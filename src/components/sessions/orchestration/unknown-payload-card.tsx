"use client";

import * as React from "react";
import { CodeBlock } from "@/components/ui/code-block";
import { FileJson2, ChevronRight, ChevronDown } from "lucide-react";

interface UnknownPayloadCardProps {
    payload: unknown;
}

export function UnknownPayloadCard({ payload }: UnknownPayloadCardProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <div className="my-2 rounded-md border border-zinc-800/60 bg-zinc-950/30 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? "Collapse raw payload" : "Expand raw payload"}
                className="flex w-full items-center justify-between px-3 py-2 hover:bg-zinc-900/50 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <FileJson2 className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="text-xs text-zinc-500">Raw Payload</span>
                </div>
                <div className="text-zinc-600">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </div>
            </button>
            <div
                className="grid transition-all duration-200 ease-in-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
                <div className="overflow-hidden">
                    <div className="px-3 pb-3 pt-1">
                        <CodeBlock language="json" value={JSON.stringify(payload, null, 2)} />
                    </div>
                </div>
            </div>
        </div>
    );
}
