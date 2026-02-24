// Gateway WebSocket Protocol Types (Protocol Version 3)

// Valid client IDs — must match one of these exactly
export type GatewayClientId =
  | "webchat-ui"
  | "openclaw-control-ui"
  | "webchat"
  | "cli"
  | "gateway-client"
  | "openclaw-macos"
  | "openclaw-ios"
  | "openclaw-android"
  | "node-host"
  | "test"
  | "fingerprint"
  | "openclaw-probe";

export type GatewayClientMode =
  | "webchat"
  | "cli"
  | "ui"
  | "backend"
  | "node"
  | "probe"
  | "test";

export type GatewayRole = "operator" | "node";

// --- Frame types ---

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: GatewayClientId;
    displayName?: string;
    version: string;
    platform: string;
    deviceFamily?: string;
    modelIdentifier?: string;
    mode: GatewayClientMode;
    instanceId?: string;
  };
  caps?: string[];
  auth?: {
    token?: string;
    password?: string;
  };
  role?: GatewayRole;
  scopes?: string[];
}

export interface HelloOkPayload {
  protocol: number;
  server: {
    version: string;
    commit?: string;
    host?: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  snapshot: Snapshot;
  policy: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
}

export interface Snapshot {
  presence: PresenceEntry[];
  health: unknown;
  stateVersion: { presence: number; health: number };
  uptimeMs: number;
  configPath?: string;
  stateDir?: string;
  sessionDefaults?: {
    defaultAgentId: string;
    mainKey: string;
    mainSessionKey: string;
    scope?: string;
  };
  authMode?: "none" | "token" | "password" | "trusted-proxy";
  updateAvailable?: {
    currentVersion: string;
    latestVersion: string;
    channel: string;
  };
}

export interface PresenceEntry {
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  mode?: string;
  ts: number;
  instanceId?: string;
  roles?: string[];
  scopes?: string[];
}

export interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

export interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };
}

export interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
}

// --- Domain types ---

export interface AgentSummary {
  id: string;
  name?: string;
  workspace?: string;
  emoji?: string;
  avatar?: string;
  default?: boolean;
  model?: string | { primary?: string; fallbacks?: string[] };
}

export interface SessionRow {
  key: string;
  kind: "direct" | "group" | "global" | "unknown";
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  lastMessagePreview?: string;
  channel?: string;
  subject?: string;
  chatType?: string;
  origin?: SessionOrigin;
  updatedAt: number | null;
  sessionId?: string;
  spawnedBy?: string;
  spawnDepth?: number;
  thinkingLevel?: string;
  modelProvider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  contextTokens?: number;
}

export interface SessionOrigin {
  label?: string;
  provider?: string;
  surface?: string;
  chatType?: string;
  from?: string;
  to?: string;
}

export interface CronJob {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  notify: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  payload: CronPayload;
  delivery?: CronDelivery;
  state: CronJobState;
}

export interface CronSchedule {
  kind: "cron" | "at" | "every";
  expr?: string;
  tz?: string;
  at?: string;
  everyMs?: number;
  staggerMs?: number;
}

export interface CronPayload {
  kind: "agentTurn" | "systemEvent";
  message: string;
  model?: string;
  thinking?: string;
  timeoutSeconds?: number;
}

export interface CronDelivery {
  mode: "none" | "announce" | "webhook";
  channel?: string;
  to?: string;
  bestEffort?: boolean;
}

export interface CronJobState {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "timeout";
  lastDurationMs?: number;
  consecutiveErrors?: number;
  lastError?: string | null;
}

export interface CronRunLogEntry {
  ts: number;
  jobId: string;
  action: "finished";
  status?: string;
  error?: string;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
}

// Event types use dot notation throughout
export type GatewayEventData =
  | { event: "tick"; payload: { ts: number } }
  | { event: "health"; payload: unknown }
  | { event: "presence"; payload: PresenceEntry }
  | { event: "cron"; payload: CronRunLogEntry }
  | { event: "chat"; payload: ChatEvent }
  | { event: "agent"; payload: AgentEvent }
  | {
      event: "shutdown";
      payload: { reason: string; restartExpectedMs?: number };
    }
  | { event: "exec.approval.requested"; payload: unknown }
  | { event: "exec.approval.resolved"; payload: unknown }
  | {
      event: "update.available";
      payload: {
        currentVersion: string;
        latestVersion: string;
        channel: string;
      };
    }
  | { event: string; payload: unknown };

export interface ChatEvent {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
}

export interface AgentEvent {
  runId: string;
  seq: number;
  stream?: boolean;
  ts: number;
  data?: unknown;
}
