import { Bot, Loader2, CheckCircle2 } from "lucide-react";
import { DelegationPayload } from "@/lib/normalize-content";

interface Props {
    payload: DelegationPayload;
    children?: React.ReactNode;
}

export function SubAgentDelegationBlock({ payload, children }: Props) {
    return (
        <div className="my-4 rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
                        <Bot className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-zinc-200">
                            Delegated to {payload.agentId}
                        </div>
                        {payload.roleDescription && (
                            <div className="text-xs text-zinc-500 mt-0.5">{payload.roleDescription}</div>
                        )}
                    </div>
                </div>
                <div>
                    {payload.status === "spinning_up" && (
                        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-800/50 px-2.5 py-1 rounded-full border border-zinc-700/50">
                            <Loader2 className="h-3 w-3 animate-spin" /> Spinning up
                        </div>
                    )}
                    {payload.status === "active" && (
                        <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                            <Loader2 className="h-3 w-3 animate-spin" /> Active
                        </div>
                    )}
                    {payload.status === "completed" && (
                        <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Completed
                        </div>
                    )}
                </div>
            </div>

            {/* Body */}
            {payload.handoffSummary && (
                <div className="px-4 py-3 text-sm text-zinc-400 italic border-b border-zinc-800/50 bg-black/20">
                    &quot;{payload.handoffSummary}&quot;
                </div>
            )}

            {/* Children */}
            {children && (
                <div className="p-4 pl-6 border-l-2 border-indigo-500/20 ml-4 my-2 flex flex-col gap-2">
                    {children}
                </div>
            )}
        </div>
    );
}
