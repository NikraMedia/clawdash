"use client";

import { useState, useRef, useContext, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { useGatewayHealth } from "@/hooks/use-gateway-health";
import { SessionStreamContext } from "@/hooks/use-session-stream";
import { Button } from "@/components/ui/button";
import { Paperclip, ChevronDown, X, Square, Send, Loader2 } from "lucide-react";
import { validateAndAddFiles } from "@/lib/file-validation";
import { Textarea } from "@/components/ui/textarea";
import { parseModelsResponse } from "@/lib/model-options";

export function Composer({ sessionKey }: { sessionKey: string }) {
    const [message, setMessage] = useState("");
    const [model, setModel] = useState("");
    const [thinkingLevel, setThinkingLevel] = useState("");
    const [attachments, setAttachments] = useState<File[]>([]);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isSendingRef = useRef(false);

    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { isOffline, hasMethod } = useGatewayHealth();
    const streamCtx = useContext(SessionStreamContext);
    const isStreaming = streamCtx?.state.isStreaming;

    const { data: modelsData, isLoading: modelsLoading } = useQuery({
        ...trpc.system.models.queryOptions(),
        staleTime: 60_000,
    });
    const modelOptions = parseModelsResponse(modelsData);

    const canSend = !isOffline && hasMethod("chat.send");
    const canAbort = !isOffline && hasMethod("chat.abort");

    // Auto-resize textarea
    const autoResize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 300) + "px";
    }, []);

    useEffect(() => { autoResize(); }, [message, autoResize]);

    // Clear file error after 4s
    useEffect(() => {
        if (!fileError) return;
        const t = setTimeout(() => setFileError(null), 4000);
        return () => clearTimeout(t);
    }, [fileError]);

    const sendMutation = useMutation(
        trpc.sessions.send.mutationOptions({
            onSuccess: () => {
                setMessage("");
                setAttachments([]);
                setMutationError(null);
                queryClient.invalidateQueries({ queryKey: trpc.sessions.history.queryKey() });
            },
            onError: (err) => {
                setMutationError(err.message ?? "Failed to send message");
            },
        })
    );

    const abortMutation = useMutation(
        trpc.sessions.abort.mutationOptions({
            onSuccess: () => {
                setMutationError(null);
                queryClient.invalidateQueries({ queryKey: trpc.sessions.history.queryKey() });
            },
            onError: (err) => {
                setMutationError(err.message ?? "Failed to abort session");
            },
        })
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            addFiles(Array.from(e.target.files));
        }
    };

    const addFiles = (files: File[]) => {
        setAttachments((prev) => {
            const { attachments: next, error } = validateAndAddFiles(files, prev);
            if (error) setFileError(error);
            return next;
        });
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleSend = async () => {
        if (isSendingRef.current || !message.trim() || !canSend || sendMutation.isPending) return;
        isSendingRef.current = true;
        const idempotencyKey = crypto.randomUUID();

        const filePayloads = await Promise.all(
            attachments.map(async (f) => {
                return new Promise<{ name: string; type: string; size: number; base64: string }>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        resolve({
                            name: f.name,
                            type: f.type,
                            size: f.size,
                            base64: e.target?.result as string,
                        });
                    };
                    reader.readAsDataURL(f);
                });
            })
        );

        try {
            sendMutation.mutate({
                sessionKey,
                message: message.trim(),
                idempotencyKey,
                model: model || undefined,
                thinkingLevel: thinkingLevel || undefined,
                attachments: filePayloads.length > 0 ? filePayloads : undefined,
            });
        } finally {
            // Release lock after mutation is fired (isPending guards further sends)
            isSendingRef.current = false;
        }
    };

    const handleAbort = () => {
        if (!canAbort) return;
        abortMutation.mutate({ sessionKey });
    };

    const isPending = sendMutation.isPending || abortMutation.isPending;

    return (
        <div className="bg-zinc-950 px-4 pb-5 pt-2">
            <div className="mx-auto max-w-3xl">
                {mutationError && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
                        <span className="text-xs text-red-400 flex-1">{mutationError}</span>
                        <button
                            onClick={() => setMutationError(null)}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}

                {fileError && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5">
                        <span className="text-[11px] text-amber-400 flex-1">{fileError}</span>
                        <button
                            onClick={() => setFileError(null)}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}

                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    className={`relative flex flex-col gap-0 rounded-2xl border bg-zinc-900/60 shadow-inner transition-all ${
                        isDragOver
                            ? "border-indigo-500/50 ring-2 ring-indigo-500/20"
                            : "border-zinc-800 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600"
                    }`}
                >
                    <Textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                            if (e.key === "Enter" && !e.shiftKey && !sendMutation.isPending) {
                                e.preventDefault();
                                handleSend();
                            } else if (e.key === "Escape") {
                                textareaRef.current?.blur();
                            }
                        }}
                        placeholder={
                            isOffline
                                ? "Gateway disconnected..."
                                : canSend
                                    ? "Message agent..."
                                    : "chat.send unavailable"
                        }
                        disabled={!canSend || isPending || isStreaming}
                        className="min-h-[56px] max-h-[300px] resize-none border-0 bg-transparent px-4 py-3 text-sm text-zinc-200 shadow-none placeholder:text-zinc-500 focus-visible:ring-0 outline-none"
                    />

                    <input
                        type="file"
                        multiple
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                    />

                    {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                            {attachments.map((file, i) => (
                                <div key={i} className="flex items-center gap-1 bg-zinc-800/60 border border-zinc-700/50 rounded-md px-2 py-0.5 text-[11px] text-zinc-300">
                                    <Paperclip className="h-2.5 w-2.5 text-zinc-500" />
                                    <span className="truncate max-w-[120px]">{file.name}</span>
                                    <button
                                        onClick={() => setAttachments((a) => a.filter((_, idx) => idx !== i))}
                                        className="ml-0.5 text-zinc-500 hover:text-red-400 transition-colors"
                                        aria-label="Remove attachment"
                                        disabled={isPending || isStreaming}
                                    >
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center justify-between border-t border-zinc-800/50 bg-zinc-900/30 px-3 py-1.5 rounded-b-2xl">
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex h-7 items-center justify-center rounded-md px-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                                aria-label="Attach file"
                                title="Attach files (Max 20MB)"
                                disabled={isPending || isStreaming}
                            >
                                <Paperclip className="h-3.5 w-3.5" />
                            </button>

                            <div className="h-3.5 w-px bg-zinc-800/60 mx-0.5" />

                            {/* Model selector */}
                            <div className="relative">
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="appearance-none rounded-md bg-transparent px-2 py-1 pr-5 text-[11px] text-zinc-500 outline-none transition-all hover:bg-zinc-800 hover:text-zinc-300 cursor-pointer"
                                    disabled={isPending || isStreaming}
                                >
                                    <option value="">Model</option>
                                    {modelsLoading ? (
                                        <option value="" disabled>Loading...</option>
                                    ) : (
                                        modelOptions.map((m) => (
                                            <option key={m.id} value={m.id}>{m.label}</option>
                                        ))
                                    )}
                                </select>
                                <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-zinc-600 pointer-events-none" />
                            </div>

                            <div className="h-3.5 w-px bg-zinc-800/60 mx-0.5" />

                            {/* Thinking Level */}
                            <div className="flex bg-zinc-900/50 p-0.5 rounded-md border border-zinc-800/60">
                                {(["", "low", "medium", "high"] as const).map((level) => (
                                    <button
                                        key={level}
                                        onClick={() => setThinkingLevel(level)}
                                        disabled={isPending || isStreaming}
                                        className={`flex h-6 items-center px-2 rounded text-[11px] font-medium transition-all ${
                                            thinkingLevel === level
                                                ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
                                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                                        }`}
                                    >
                                        {level === "" ? "Default" : level.charAt(0).toUpperCase() + level.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {isStreaming ? (
                            <Button
                                onClick={handleAbort}
                                disabled={!canAbort || abortMutation.isPending}
                                variant="destructive"
                                size="sm"
                                className="h-7 shrink-0 rounded-lg px-3 text-[11px] font-semibold"
                            >
                                <Square className="h-3 w-3 mr-1 fill-current" />
                                Stop
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSend}
                                disabled={!message.trim() || !canSend || isPending}
                                size="sm"
                                className="h-7 shrink-0 rounded-lg bg-zinc-100 px-3 text-[11px] font-semibold text-zinc-900 transition-all hover:bg-white active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-zinc-100 shadow-[0_0_12px_rgba(255,255,255,0.08)]"
                            >
                                {sendMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="h-3 w-3 mr-1" />
                                        Send
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
