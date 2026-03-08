"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { useGatewayHealth } from "@/hooks/use-gateway-health";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Paperclip, ChevronDown, X, Send, Loader2 } from "lucide-react";
import { validateAndAddFiles } from "@/lib/file-validation";
import { Textarea } from "@/components/ui/textarea";
import { parseModelsResponse } from "@/lib/model-options";
import { stripMarkdown, stripRoutingTags } from "@/lib/session-utils";

export default function NewSessionPage() {
  const [agentId, setAgentId] = useState("");
  const [message, setMessage] = useState("");
  const [model, setModel] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [skill, setSkill] = useState("");
  const [thinkingLevel, setThinkingLevel] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSendingRef = useRef(false);

  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isOffline, hasMethod } = useGatewayHealth();

  const { data: agentsData } = useQuery(trpc.agents.list.queryOptions());
  const agents = agentsData?.agents ?? [];

  const { data: modelsData } = useQuery({
    ...trpc.system.models.queryOptions(),
    staleTime: 60_000,
  });
  const modelOptions = parseModelsResponse(modelsData);

  const canSend = !isOffline && hasMethod("chat.send");

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 300) + "px";
  }, []);

  useEffect(() => { autoResize(); }, [message, autoResize]);

  useEffect(() => {
    if (!fileError) return;
    const t = setTimeout(() => setFileError(null), 4000);
    return () => clearTimeout(t);
  }, [fileError]);

  const sendMutation = useMutation(trpc.sessions.send.mutationOptions());
  const patchMutation = useMutation(trpc.sessions.patch.mutationOptions());

  const addFiles = (files: File[]) => {
    setAttachments((prev) => {
      const { attachments: next, error } = validateAndAddFiles(files, prev);
      if (error) setFileError(error);
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleCreate = async () => {
    // Ref-based lock prevents race condition where rapid Enter presses
    // bypass the React state isPending check between renders
    if (isSendingRef.current || sendMutation.isPending || patchMutation.isPending) return;
    if (!agentId) {
      setFileError("Please select an agent before sending.");
      return;
    }
    if (!message.trim()) return;
    isSendingRef.current = true;

    const trimmedMsg = message.trim();
    const sessionKey = `agent:${agentId}:${Date.now()}`;
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
      // 1. Send message to gateway
      await sendMutation.mutateAsync({
        sessionKey,
        message: trimmedMsg,
        idempotencyKey,
        model: model || undefined,
        thinkingLevel: thinkingLevel || undefined,
        workflow: workflow || undefined,
        skills: skill ? [skill] : undefined,
        attachments: filePayloads.length > 0 ? filePayloads : undefined,
      });

      // 2. Patch session with a readable label (await before navigating)
      let cleaned = stripMarkdown(stripRoutingTags(trimmedMsg));
      const fillerRe = /^(hey|hi|hello|yo|ok|okay|sure|please|can you|could you|i need you to|i want you to|i'd like you to)[,!.:\s]*/i;
      let prev = "";
      while (cleaned !== prev) { prev = cleaned; cleaned = cleaned.replace(fillerRe, ""); }
      cleaned = cleaned.trim();
      const titled = cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : trimmedMsg;
      const label = titled.length > 60
        ? titled.slice(0, titled.lastIndexOf(" ", 60) > 24 ? titled.lastIndexOf(" ", 60) : 60).replace(/[,;:\s]+$/, "") + "\u2026"
        : titled;
      try {
        await patchMutation.mutateAsync({ key: sessionKey, label });
      } catch {
        // best-effort — label patch failure shouldn't block navigation
      }

      // 3. Navigate to the new session
      queryClient.invalidateQueries({ queryKey: trpc.sessions.list.queryKey() });
      setMessage("");
      setAttachments([]);
      router.push(`/sessions/${encodeURIComponent(sessionKey)}`);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      isSendingRef.current = false;
    }
  };

  const selectClass = "w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none transition-all focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 hover:bg-zinc-800/50";

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 bg-zinc-950 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center my-auto">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900/80 ring-1 ring-zinc-800">
          <MessageSquarePlus className="h-7 w-7 text-zinc-400" />
        </div>
        <h1 className="mb-1.5 text-xl font-semibold tracking-tight text-zinc-50">
          New Session
        </h1>
        <p className="mb-6 max-w-sm text-sm text-zinc-500">
          Configure your agent and send your first message.
        </p>

        <div className="w-full rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 shadow-lg">

          {/* Configuration Grid */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[11px] font-medium text-zinc-500 px-0.5">Agent</label>
              <div className="relative">
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className={selectClass}
                  disabled={sendMutation.isPending}
                >
                  <option value="">Select agent...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.emoji ? `${a.emoji} ` : ""}{a.name ?? a.id}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1 text-left">
              <label className="text-[11px] font-medium text-zinc-500 px-0.5">Model</label>
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className={selectClass}
                  disabled={sendMutation.isPending}
                >
                  <option value="">Agent Default</option>
                  {modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1 text-left">
              <label className="text-[11px] font-medium text-zinc-500 px-0.5">Workflow</label>
              <div className="relative">
                <select
                  value={workflow}
                  onChange={(e) => setWorkflow(e.target.value)}
                  className={selectClass}
                  disabled={sendMutation.isPending}
                >
                  <option value="">None</option>
                  <option value="scaffold">Scaffold (/scaffold)</option>
                  <option value="pr-review">PR Review (/pr-review)</option>
                  <option value="atomic-commit">Atomic Commit (/atomic-commit)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col gap-1 text-left">
              <label className="text-[11px] font-medium text-zinc-500 px-0.5">Skills</label>
              <div className="relative">
                <select
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  className={selectClass}
                  disabled={sendMutation.isPending}
                >
                  <option value="">Default</option>
                  <option value="web-tavily">Web Search (Tavily)</option>
                  <option value="mcp-local">Local Filesystem (MCP)</option>
                  <option value="all">Full Tool Belt</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
              </div>
            </div>
          </div>

          <input
            type="file"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          {fileError && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5">
              <span className="text-[11px] text-amber-400 flex-1">{fileError}</span>
              <button onClick={() => setFileError(null)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Main Input */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`relative rounded-xl border bg-zinc-900/60 shadow-inner transition-all flex flex-col ${isDragOver
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
                  handleCreate();
                }
              }}
              placeholder={!agentId ? "Select an agent above, then type your message..." : "What can I help you with?"}
              className="min-h-[120px] max-h-[300px] resize-none border-0 bg-transparent px-4 py-3 text-sm placeholder:text-zinc-500 focus-visible:ring-0 rounded-t-xl text-zinc-200"
              disabled={sendMutation.isPending}
            />

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-1 bg-zinc-800/60 border border-zinc-700/50 rounded-md px-2 py-0.5 text-[11px] text-zinc-300">
                    <Paperclip className="h-2.5 w-2.5 text-zinc-500" />
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button
                      onClick={() => setAttachments(a => a.filter((_, idx) => idx !== i))}
                      className="ml-0.5 text-zinc-500 hover:text-red-400 transition-colors"
                      aria-label="Remove attachment"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between border-t border-zinc-800/50 bg-zinc-900/30 px-3 py-1.5 rounded-b-xl gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-7 items-center justify-center rounded-md px-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors shrink-0"
                  aria-label="Attach file"
                  title="Attach files (Max 20MB)"
                  disabled={sendMutation.isPending}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </button>

                <div className="h-3.5 w-px bg-zinc-800/60 mx-0.5 hidden sm:block" />

                {/* Thinking Level — hidden on mobile */}
                <div className="hidden sm:flex bg-zinc-900/50 p-0.5 rounded-md border border-zinc-800/60">
                  {(["", "low", "medium", "high"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setThinkingLevel(level)}
                      disabled={sendMutation.isPending}
                      className={`flex h-6 items-center px-2 rounded text-[11px] font-medium transition-all ${thinkingLevel === level
                        ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                        }`}
                    >
                      {level === "" ? "Default" : level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleCreate}
                disabled={!message.trim() || !agentId || !canSend || sendMutation.isPending}
                size="sm"
                className="h-7 shrink-0 rounded-lg bg-zinc-100 px-3 text-[11px] font-semibold text-zinc-900 transition-all hover:bg-white active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-zinc-100 shadow-[0_0_12px_rgba(255,255,255,0.08)]"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-1" />
                    Start Session
                  </>
                )}
              </Button>
            </div>
          </div>

          {!canSend && (
            <p className="mt-3 text-xs text-red-400/70 text-left px-1">
              Gateway is disconnected or chat.send is unavailable.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
