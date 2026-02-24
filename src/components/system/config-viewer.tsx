"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  FileJson2,
  Loader2,
  RefreshCcw,
  Save,
  WandSparkles,
} from "lucide-react";
import { useTRPC } from "@/lib/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { Textarea } from "@/components/ui/textarea";

interface ConfigResponse {
  raw: string;
  hash: string;
}

interface ParseResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

function isConfigResponse(data: unknown): data is ConfigResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as { raw?: unknown }).raw === "string" &&
    typeof (data as { hash?: unknown }).hash === "string"
  );
}

function parseJson(raw: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function collectDiffPaths(
  previousValue: unknown,
  nextValue: unknown,
  path: string,
  max: number,
  output: string[]
) {
  if (output.length >= max) return;

  if (Object.is(previousValue, nextValue)) return;

  if (Array.isArray(previousValue) && Array.isArray(nextValue)) {
    const maxLength = Math.max(previousValue.length, nextValue.length);
    for (let index = 0; index < maxLength; index += 1) {
      const childPath = `${path}[${index}]`;
      collectDiffPaths(
        previousValue[index],
        nextValue[index],
        childPath,
        max,
        output
      );
      if (output.length >= max) return;
    }
    return;
  }

  const previousRecord = toRecord(previousValue);
  const nextRecord = toRecord(nextValue);

  if (previousRecord && nextRecord) {
    const keys = new Set([
      ...Object.keys(previousRecord),
      ...Object.keys(nextRecord),
    ]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      collectDiffPaths(
        previousRecord[key],
        nextRecord[key],
        childPath,
        max,
        output
      );
      if (output.length >= max) return;
    }
    return;
  }

  output.push(path || "$");
}

function listDiffPaths(
  previousValue: unknown,
  nextValue: unknown,
  max = 24
): string[] {
  const paths: string[] = [];
  collectDiffPaths(previousValue, nextValue, "", max, paths);
  return paths;
}

function countLineChanges(previousRaw: string, nextRaw: string): number {
  const previousLines = previousRaw.split("\n");
  const nextLines = nextRaw.split("\n");
  const maxLength = Math.max(previousLines.length, nextLines.length);

  let changed = 0;
  for (let index = 0; index < maxLength; index += 1) {
    if (previousLines[index] !== nextLines[index]) changed += 1;
  }
  return changed;
}

function ConfigEditor({ data }: { data: ConfigResponse }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [editorRaw, setEditorRaw] = useState(data.raw);
  const [baselineRaw, setBaselineRaw] = useState(data.raw);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSavedNotice, setShowSavedNotice] = useState(false);

  const baselineParse = useMemo(() => parseJson(baselineRaw), [baselineRaw]);
  const editorParse = useMemo(() => parseJson(editorRaw), [editorRaw]);

  const dirty = editorRaw !== baselineRaw;
  const baselineIsJson = baselineParse.ok;
  const draftIsValid = !baselineIsJson || editorParse.ok;

  const diffPaths = useMemo(() => {
    if (!dirty) return [];
    if (!baselineParse.ok || !editorParse.ok) return [];
    return listDiffPaths(baselineParse.value, editorParse.value, 24);
  }, [dirty, baselineParse, editorParse]);

  const changedLines = useMemo(() => {
    if (!dirty) return 0;
    return countLineChanges(baselineRaw, editorRaw);
  }, [dirty, baselineRaw, editorRaw]);

  const updateMutation = useMutation(
    trpc.system.configUpdate.mutationOptions({
      onSuccess: () => {
        setSaveError(null);
        setBaselineRaw(editorRaw);
        setShowSavedNotice(true);
        queryClient.invalidateQueries({ queryKey: trpc.system.config.queryKey() });
      },
      onError: (mutationError) => {
        setSaveError(mutationError.message || "Failed to save configuration");
      },
    })
  );

  const canSave = dirty && draftIsValid && !updateMutation.isPending;
  const canFormat = baselineIsJson && editorParse.ok && !updateMutation.isPending;

  const handleSave = () => {
    if (!canSave) return;
    updateMutation.mutate({ raw: editorRaw, baseHash: data.hash });
  };

  const handleDiscard = () => {
    setEditorRaw(baselineRaw);
    setSaveError(null);
    setShowSavedNotice(false);
  };

  const handleFormat = () => {
    if (!editorParse.ok) return;
    setEditorRaw(`${JSON.stringify(editorParse.value, null, 2)}\n`);
    setShowSavedNotice(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Card className="border-zinc-800 bg-zinc-900/40 shadow-md backdrop-blur-sm">
        <CardHeader className="border-b border-zinc-800/70 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-medium text-zinc-200">
                Gateway Configuration
              </CardTitle>
              <p className="mt-1 text-xs text-zinc-500">
                Explicit save with optimistic locking (`baseHash`).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {dirty ? (
                <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-400">
                  Unsaved Changes
                </Badge>
              ) : (
                <Badge className="border-zinc-700 bg-zinc-800/60 text-zinc-400">
                  In Sync
                </Badge>
              )}
              {draftIsValid ? (
                <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
                  Valid
                </Badge>
              ) : (
                <Badge className="border-red-500/30 bg-red-500/15 text-red-400">
                  Invalid
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {saveError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="leading-relaxed">{saveError}</p>
            </div>
          )}

          {showSavedNotice && !dirty && !updateMutation.isPending && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p>Configuration saved successfully.</p>
            </div>
          )}

          {!draftIsValid && baselineIsJson && (
            <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200">
              <p className="font-semibold text-red-300">JSON validation failed</p>
              <p className="mt-1 font-mono text-[11px]">{editorParse.error}</p>
            </div>
          )}

          <label className="sr-only" htmlFor="system-config-editor">
            System configuration editor
          </label>
          <Textarea
            id="system-config-editor"
            value={editorRaw}
            onChange={(event) => {
              setEditorRaw(event.target.value);
              setSaveError(null);
              setShowSavedNotice(false);
            }}
            spellCheck={false}
            className="h-[520px] resize-none overflow-auto border-zinc-800 bg-zinc-950/60 font-mono text-xs leading-relaxed text-zinc-200 focus-visible:ring-indigo-500/30"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">
              {dirty
                ? `${changedLines.toLocaleString()} changed line${
                    changedLines === 1 ? "" : "s"
                  }`
                : "No pending edits"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFormat}
                disabled={!canFormat}
                className="border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <WandSparkles className="mr-1.5 h-3.5 w-3.5" />
                Format
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                disabled={!dirty || updateMutation.isPending}
                className="border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={!canSave}
                className="bg-indigo-500/90 text-white hover:bg-indigo-400"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-zinc-800 bg-zinc-900/40 shadow-md backdrop-blur-sm">
          <CardHeader className="border-b border-zinc-800/70 pb-3">
            <CardTitle className="text-sm font-medium text-zinc-200">
              Change Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {dirty ? (
              baselineParse.ok && editorParse.ok ? (
                diffPaths.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-zinc-500">
                      {diffPaths.length.toLocaleString()} changed path
                      {diffPaths.length === 1 ? "" : "s"} (showing up to 24)
                    </p>
                    <div className="max-h-[240px] overflow-auto rounded-md border border-zinc-800 bg-zinc-950/60 p-2">
                      {diffPaths.map((path) => (
                        <div
                          key={path}
                          className="border-b border-zinc-800/60 px-1.5 py-1 font-mono text-[11px] text-zinc-300 last:border-0"
                        >
                          {path}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Content changed, but no structured path differences were detected.
                  </p>
                )
              ) : (
                <p className="text-sm text-zinc-500">
                  Structured diff is available when the draft is valid JSON.
                </p>
              )
            ) : (
              <p className="text-sm text-zinc-500">
                Edit the configuration to preview changed fields before saving.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/40 shadow-md backdrop-blur-sm">
          <CardHeader className="border-b border-zinc-800/70 pb-3">
            <CardTitle className="text-sm font-medium text-zinc-200">
              Current Payload
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <CodeBlock
              language={baselineIsJson ? "json" : "yaml"}
              value={baselineRaw}
              className="max-h-[260px] overflow-auto rounded-none border-0 bg-zinc-950/70 shadow-none text-xs"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ConfigViewer() {
  const trpc = useTRPC();

  const { data: rawData, isLoading, isError, error, refetch } = useQuery(
    trpc.system.config.queryOptions()
  );

  const data = isConfigResponse(rawData) ? rawData : null;

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[520px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
        <div className="h-[520px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
      </div>
    );
  }

  if (isError) {
    return <QueryError error={error} label="system configuration" onRetry={refetch} />;
  }

  if (!data) {
    return (
      <EmptyState
        icon={FileJson2}
        title="No Configuration Payload"
        description="The gateway did not return a configuration payload."
      />
    );
  }

  return <ConfigEditor key={data.hash} data={data} />;
}
