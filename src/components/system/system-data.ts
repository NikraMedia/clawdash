"use client";

export interface SystemChannel {
  key: string;
  id?: string;
  name: string;
  type?: string;
  agentId?: string;
  status: string;
  connected: boolean;
  error?: string;
  raw: Record<string, unknown>;
}

export interface SystemApproval {
  key: string;
  id?: string;
  sessionKey?: string;
  toolName: string;
  agentId?: string;
  status: string;
  pending: boolean;
  requestedAtMs?: number;
  resolvedAtMs?: number;
  summary?: string;
  raw: Record<string, unknown>;
}

export interface SystemSkill {
  key: string;
  id?: string;
  name: string;
  description?: string;
  agentId?: string;
  enabled?: boolean;
  raw: Record<string, unknown>;
}

export interface SystemModel {
  key: string;
  id?: string;
  name: string;
  provider?: string;
  type?: string;
  contextWindow?: number;
  maxOutput?: number;
  capabilities: string[];
  default: boolean;
  raw: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function toTimestampMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    // If timestamp looks like seconds, convert to milliseconds.
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return undefined;
}

function isChannelConnected(record: Record<string, unknown>): boolean {
  if (typeof record.connected === "boolean") return record.connected;
  if (typeof record.running === "boolean") return record.running;
  if (typeof record.configured === "boolean") return record.configured;

  const status = asString(record.status)?.toLowerCase();
  if (!status) return false;

  if (["connected", "ok", "ready", "active", "online"].includes(status)) {
    return true;
  }
  if (["disconnected", "offline", "error", "failed"].includes(status)) {
    return false;
  }
  return false;
}

function normalizeChannelRecord(
  defaultName: string,
  value: unknown
): SystemChannel | null {
  const record = asRecord(value);
  if (!record) return null;

  const name = asString(record.name) ?? defaultName;
  const id = asString(record.id);
  const type = asString(record.type) ?? asString(record.kind);
  const agentId =
    asString(record.agentId) ??
    asString(record.agent_id) ??
    asString(record.agent);

  const connected = isChannelConnected(record);
  const status =
    asString(record.status)?.toLowerCase() ??
    (connected ? "connected" : "disconnected");
  const error = asString(record.error) ?? asString(record.lastError);
  const key = id ?? asString(record.key) ?? name;

  return {
    key,
    id,
    name,
    type,
    agentId,
    status,
    connected,
    error,
    raw: record,
  };
}

export function normalizeChannelsData(data: unknown): SystemChannel[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    return data
      .map((entry, idx) => normalizeChannelRecord(`channel-${idx + 1}`, entry))
      .filter((entry): entry is SystemChannel => entry !== null);
  }

  const record = asRecord(data);
  if (!record) return [];

  if (Array.isArray(record.channels)) {
    return record.channels
      .map((entry, idx) => normalizeChannelRecord(`channel-${idx + 1}`, entry))
      .filter((entry): entry is SystemChannel => entry !== null);
  }

  const channelMap =
    (asRecord(record.channels) as Record<string, unknown> | null) ?? record;

  return Object.entries(channelMap)
    .map(([name, value]) => normalizeChannelRecord(name, value))
    .filter((entry): entry is SystemChannel => entry !== null);
}

function approvalStatusFromRecord(record: Record<string, unknown>): {
  status: string;
  pending: boolean;
} {
  const rawStatus = (
    asString(record.status) ??
    asString(record.resolution) ??
    asString(record.state)
  )?.toLowerCase();

  if (!rawStatus) return { status: "pending", pending: true };
  if (rawStatus === "denied") return { status: "rejected", pending: false };
  if (rawStatus === "approved") return { status: "approved", pending: false };
  if (rawStatus === "rejected") return { status: "rejected", pending: false };
  if (rawStatus === "resolved") return { status: "resolved", pending: false };
  if (rawStatus === "pending") return { status: "pending", pending: true };

  return {
    status: rawStatus,
    pending: !["approved", "rejected", "resolved"].includes(rawStatus),
  };
}

function normalizeApprovalRecord(
  value: unknown,
  index: number
): SystemApproval | null {
  const record = asRecord(value);
  if (!record) return null;

  const id = asString(record.id);
  const sessionKey =
    asString(record.sessionKey) ??
    asString(record.session_key) ??
    asString(record.sessionId) ??
    asString(record.session_id);
  const toolName =
    asString(record.tool) ??
    asString(record.toolName) ??
    asString(record.action) ??
    asString(record.command) ??
    id ??
    `Request ${index + 1}`;
  const agentId =
    asString(record.agent) ??
    asString(record.agentId) ??
    asString(record.agent_id);

  const requestedAtMs =
    toTimestampMs(record.requestedAt) ??
    toTimestampMs(record.requested_at) ??
    toTimestampMs(record.createdAt) ??
    toTimestampMs(record.created_at) ??
    toTimestampMs(record.ts);

  const resolvedAtMs =
    toTimestampMs(record.resolvedAt) ??
    toTimestampMs(record.resolved_at) ??
    toTimestampMs(record.updatedAt) ??
    toTimestampMs(record.updated_at);

  const summary =
    asString(record.summary) ??
    asString(record.reason) ??
    asString(record.description) ??
    asString(record.actionDescription);

  const { status, pending } = approvalStatusFromRecord(record);
  const key = id ?? sessionKey ?? `${toolName}-${requestedAtMs ?? index}`;

  return {
    key,
    id,
    sessionKey,
    toolName,
    agentId,
    status,
    pending,
    requestedAtMs,
    resolvedAtMs,
    summary,
    raw: record,
  };
}

function extractApprovalArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;

  const record = asRecord(data);
  if (!record) return [];

  if (Array.isArray(record.pending)) return record.pending;
  if (Array.isArray(record.approvals)) return record.approvals;
  if (Array.isArray(record.requests)) return record.requests;

  const pendingMap = asRecord(record.pending);
  if (pendingMap) return Object.values(pendingMap);

  const approvalsMap = asRecord(record.approvals);
  if (approvalsMap) return Object.values(approvalsMap);

  return [];
}

export function normalizeApprovalsData(data: unknown): SystemApproval[] {
  const entries = extractApprovalArray(data);
  return entries
    .map((entry, idx) => normalizeApprovalRecord(entry, idx))
    .filter((entry): entry is SystemApproval => entry !== null);
}

interface SkillEntry {
  value: unknown;
  agentIdHint?: string;
}

function collectSkillEntries(
  value: unknown,
  output: SkillEntry[],
  agentIdHint?: string
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const entryRecord = asRecord(entry);

      if (entryRecord && (Array.isArray(entryRecord.skills) || asRecord(entryRecord.skills))) {
        const nestedAgent =
          asString(entryRecord.agentId) ??
          asString(entryRecord.agent_id) ??
          asString(entryRecord.id) ??
          asString(entryRecord.name) ??
          agentIdHint;
        collectSkillEntries(entryRecord.skills, output, nestedAgent);
        continue;
      }

      output.push({ value: entry, agentIdHint });
    }
    return;
  }

  const record = asRecord(value);
  if (!record) return;

  if (Array.isArray(record.skills) || asRecord(record.skills)) {
    const nestedAgent =
      asString(record.agentId) ??
      asString(record.agent_id) ??
      asString(record.id) ??
      asString(record.name) ??
      agentIdHint;
    collectSkillEntries(record.skills, output, nestedAgent);
    return;
  }

  if (Array.isArray(record.agents) || asRecord(record.agents)) {
    collectSkillEntries(record.agents, output, agentIdHint);
    return;
  }

  for (const [key, nested] of Object.entries(record)) {
    const nestedRecord = asRecord(nested);
    if (Array.isArray(nested) || (nestedRecord && ("skills" in nestedRecord || "agentId" in nestedRecord || "agent" in nestedRecord))) {
      collectSkillEntries(nested, output, agentIdHint ?? key);
    }
  }
}

function normalizeSkillRecord(
  value: unknown,
  index: number,
  agentIdHint?: string
): SystemSkill | null {
  const record = asRecord(value);
  if (!record) return null;

  const id =
    asString(record.id) ??
    asString(record.skillId) ??
    asString(record.slug) ??
    asString(record.key);
  const name =
    asString(record.name) ??
    asString(record.title) ??
    id ??
    `Skill ${index + 1}`;
  const description =
    asString(record.description) ??
    asString(record.summary) ??
    asString(record.help);
  const agentId =
    asString(record.agentId) ??
    asString(record.agent_id) ??
    asString(record.agent) ??
    agentIdHint;
  const enabled =
    asBoolean(record.enabled) ??
    asBoolean(record.active) ??
    asBoolean(record.isEnabled);

  const key = id ?? `${agentId ?? "global"}-${name}-${index}`;

  return {
    key,
    id,
    name,
    description,
    agentId,
    enabled,
    raw: record,
  };
}

export function normalizeSkillsData(data: unknown): SystemSkill[] {
  const entries: SkillEntry[] = [];
  collectSkillEntries(data, entries);

  return entries
    .map((entry, idx) => normalizeSkillRecord(entry.value, idx, entry.agentIdHint))
    .filter((entry): entry is SystemSkill => entry !== null);
}

interface ModelEntry {
  value: unknown;
  providerHint?: string;
}

function collectModelEntries(
  value: unknown,
  output: ModelEntry[],
  providerHint?: string
): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      output.push({ value: entry, providerHint });
    }
    return;
  }

  const record = asRecord(value);
  if (!record) return;

  if (Array.isArray(record.models)) {
    collectModelEntries(record.models, output, providerHint);
    return;
  }

  if (Array.isArray(record.catalog)) {
    collectModelEntries(record.catalog, output, providerHint);
    return;
  }

  if (Array.isArray(record.data)) {
    collectModelEntries(record.data, output, providerHint);
    return;
  }

  if (Array.isArray(record.items)) {
    collectModelEntries(record.items, output, providerHint);
    return;
  }

  const providers = asRecord(record.providers);
  if (providers) {
    for (const [provider, providerEntry] of Object.entries(providers)) {
      const providerRecord = asRecord(providerEntry);
      if (Array.isArray(providerEntry)) {
        collectModelEntries(providerEntry, output, provider);
      } else if (providerRecord && (Array.isArray(providerRecord.models) || Array.isArray(providerRecord.data))) {
        collectModelEntries(
          providerRecord.models ?? providerRecord.data,
          output,
          provider
        );
      }
    }
    return;
  }

  // Fallback for map-like responses keyed by model id.
  for (const [modelId, nested] of Object.entries(record)) {
    const nestedRecord = asRecord(nested);
    if (!nestedRecord) continue;

    const entryWithId = {
      ...nestedRecord,
      id: asString(nestedRecord.id) ?? modelId,
    };
    output.push({ value: entryWithId, providerHint });
  }
}

function normalizeModelRecord(
  value: unknown,
  index: number,
  providerHint?: string
): SystemModel | null {
  const record = asRecord(value);
  if (!record) return null;

  const id =
    asString(record.id) ??
    asString(record.model) ??
    asString(record.slug);
  const name = asString(record.name) ?? asString(record.displayName) ?? id ?? `Model ${index + 1}`;
  const provider =
    asString(record.provider) ??
    asString(record.owned_by) ??
    asString(record.provider_name) ??
    providerHint;

  const contextWindow =
    asNumber(record.contextWindow) ??
    asNumber(record.context_window) ??
    asNumber(record.contextLength) ??
    asNumber(record.context_length) ??
    asNumber(record.maxContextTokens) ??
    asNumber(record.max_input_tokens);

  const maxOutput =
    asNumber(record.maxOutput) ??
    asNumber(record.maxOutputTokens) ??
    asNumber(record.max_tokens) ??
    asNumber(record.max_completion_tokens) ??
    asNumber(record.output_tokens);

  const capabilities =
    asStringArray(record.capabilities).length > 0
      ? asStringArray(record.capabilities)
      : asStringArray(record.tags).length > 0
        ? asStringArray(record.tags)
        : asStringArray(record.features);

  const type =
    asString(record.type) ??
    asString(record.modelType) ??
    asString(record.modality);

  const defaultModel =
    asBoolean(record.default) ??
    asBoolean(record.isDefault) ??
    asBoolean(record.primary) ??
    false;

  const key = id ?? `${provider ?? "model"}-${name}-${index}`;

  return {
    key,
    id,
    name,
    provider,
    type,
    contextWindow,
    maxOutput,
    capabilities,
    default: defaultModel,
    raw: record,
  };
}

export function normalizeModelsData(data: unknown): SystemModel[] {
  const entries: ModelEntry[] = [];
  collectModelEntries(data, entries);

  return entries
    .map((entry, idx) => normalizeModelRecord(entry.value, idx, entry.providerHint))
    .filter((entry): entry is SystemModel => entry !== null);
}

export function countPendingApprovals(data: unknown): number {
  return normalizeApprovalsData(data).filter((approval) => approval.pending)
    .length;
}

export function countDisconnectedChannels(data: unknown): number {
  return normalizeChannelsData(data).filter((channel) => !channel.connected)
    .length;
}

export function approvalResolveTarget(
  approval: SystemApproval
): { id?: string; sessionKey?: string } | null {
  if (approval.id) return { id: approval.id };
  if (approval.sessionKey) return { sessionKey: approval.sessionKey };
  return null;
}
