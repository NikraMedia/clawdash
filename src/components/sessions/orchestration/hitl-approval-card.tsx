"use client";

import * as React from "react";
import { ShieldAlert, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { ApprovalPayload } from "@/lib/normalize-content";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";

interface Props {
    payload: ApprovalPayload;
    sessionKey?: string;
}

export function HitlApprovalCard({ payload, sessionKey }: Props) {
    const [localResolution, setLocalResolution] = React.useState<"approved" | "rejected" | undefined>(undefined);
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const resolution = localResolution ?? payload.resolution;
    const isResolved = !!resolution;
    const isApproved = resolution === "approved";

    const mutation = useMutation(
        trpc.sessions.resolveApproval.mutationOptions({
            onSuccess: (_data, variables) => {
                setLocalResolution(variables.resolution);
                queryClient.invalidateQueries({ queryKey: trpc.sessions.history.queryKey() });
            },
        })
    );

    const handleResolve = (decision: "approved" | "rejected") => {
        if (!sessionKey || mutation.isPending) return;
        mutation.mutate({ sessionKey, resolution: decision });
    };

    return (
        <div className="my-3 rounded-lg border border-amber-900/40 bg-amber-950/10 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-amber-950/20 border-b border-amber-900/30">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-500 ring-1 ring-inset ring-amber-500/20">
                        <ShieldAlert className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-medium text-amber-400">
                        Approval Required
                    </span>
                </div>
                <div>
                    {isResolved ? (
                        isApproved ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                                <CheckCircle2 className="h-3 w-3" /> Approved
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-[10px] text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 font-medium">
                                <XCircle className="h-3 w-3" /> Rejected
                            </div>
                        )
                    ) : (
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-500/80 font-medium">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                            </span>
                            Pending
                        </div>
                    )}
                </div>
            </div>

            <div className="px-4 py-2.5 text-sm text-zinc-300">
                {payload.actionDescription}
            </div>

            {mutation.error && (
                <div className="px-4 pb-2 text-xs text-red-400">
                    {mutation.error.message}
                </div>
            )}

            {!isResolved && sessionKey && (
                <div className="px-4 py-2.5 bg-black/20 border-t border-amber-900/20 flex gap-2.5">
                    <button
                        onClick={() => handleResolve("approved")}
                        disabled={mutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-50 text-white py-1.5 text-xs font-medium transition-colors"
                    >
                        {mutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <>
                                <CheckCircle2 className="h-3 w-3" />
                                Approve
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => handleResolve("rejected")}
                        disabled={mutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-red-900/40 hover:bg-red-950/50 disabled:opacity-50 text-red-400 py-1.5 text-xs font-medium transition-colors"
                    >
                        <XCircle className="h-3 w-3" />
                        Reject
                    </button>
                </div>
            )}
        </div>
    );
}
