import WebSocket from "ws";
import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import type {
  ConnectParams,
  HelloOkPayload,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  Snapshot,
  GatewayEventData,
  CronJob,
  CronRunLogEntry,
} from "./types";

// Origin header required for controlUi auth bypass on loopback
const REQUIRED_ORIGIN =
  process.env.CLAW_DASH_ORIGIN || "http://localhost:3939";

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class GatewayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private connecting = false;
  private pending = new Map<string, PendingRequest>();
  private helloPayload: HelloOkPayload | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private connectReqId: string | null = null;
  private availableMethods: Set<string> = new Set();
  private availableEvents: Set<string> = new Set();
  private backoffMs = MIN_BACKOFF_MS;
  private intentionalClose = false;

  constructor(
    private url: string,
    private token: string
  ) {
    super();
  }

  get isConnected() {
    return this.connected;
  }

  get currentSnapshot(): Snapshot | null {
    return this.helloPayload?.snapshot ?? null;
  }

  get server() {
    return this.helloPayload?.server ?? null;
  }

  get methods(): string[] {
    return this.helloPayload?.features.methods ?? [];
  }

  get events(): string[] {
    return this.helloPayload?.features.events ?? [];
  }

  hasMethod(method: string): boolean {
    return this.availableMethods.has(method);
  }

  hasEvent(event: string): boolean {
    return this.availableEvents.has(event);
  }

  connect(): void {
    if (this.ws) return;
    if (this.connecting) return;
    this.intentionalClose = false;
    this.connecting = true;

    this.ws = new WebSocket(this.url, {
      headers: { origin: REQUIRED_ORIGIN },
    });

    this.ws.on("open", () => {
      // Handshake MUST be a RequestFrame with method "connect"
      this.connectReqId = randomUUID();

      const connectParams: ConnectParams = {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "openclaw-control-ui",
          displayName: "Claw Dash",
          version: "0.1.0",
          platform: process.platform,
          mode: "backend",
          instanceId: randomUUID().slice(0, 8),
        },
        auth: { token: this.token },
        role: "operator",
        scopes: ["operator.read", "operator.write", "operator.admin"],
      };

      const frame: RequestFrame = {
        type: "req",
        id: this.connectReqId,
        method: "connect",
        params: connectParams,
      };

      try {
        this.ws!.send(JSON.stringify(frame));
      } catch (err) {
        console.error("[claw-dash] Failed to send connect frame:", (err as Error).message);
      }
      this.connecting = false;
    });

    this.ws.on("message", (data) => {
      let frame: Record<string, unknown>;
      try {
        frame = JSON.parse(data.toString()) as Record<string, unknown>;
      } catch (e) {
        console.error("[claw-dash] Malformed gateway frame, skipping:", (e as Error).message);
        return;
      }

      if (frame.type === "res") {
        const res = frame as unknown as ResponseFrame;

        // Handle the connect response — hello-ok is in res.payload
        if (res.id === this.connectReqId) {
          this.connectReqId = null;
          if (res.ok && res.payload) {
            this.helloPayload = res.payload as HelloOkPayload;
            this.availableMethods = new Set(
              this.helloPayload.features.methods
            );
            this.availableEvents = new Set(
              this.helloPayload.features.events
            );
            this.connected = true;
            this.backoffMs = MIN_BACKOFF_MS;
            this.emit("connected", this.helloPayload);
          } else {
            this.emit(
              "error",
              new Error(
                `Gateway handshake failed: ${res.error?.message || "unknown"}`
              )
            );
          }
          return;
        }

        // Handle normal RPC responses
        const pending = this.pending.get(res.id);
        if (pending) {
          this.pending.delete(res.id);
          clearTimeout(pending.timer);
          if (res.ok) {
            pending.resolve(res.payload);
          } else {
            pending.reject(new Error(res.error?.message || "RPC error"));
          }
        }
        return;
      }

      if (frame.type === "event") {
        const event = frame as unknown as EventFrame;
        this.emit("event", {
          event: event.event,
          payload: event.payload,
        } as GatewayEventData);
        this.emit(`event:${event.event}`, event.payload);

        if (event.stateVersion && this.helloPayload) {
          this.helloPayload.snapshot.stateVersion = event.stateVersion;
        }
        return;
      }
    });

    this.ws.on("close", () => {
      this.ws = null;
      this.connected = false;
      this.connecting = false;
      this.connectReqId = null;
      this.rejectAllPending("Connection closed");
      this.emit("disconnected");
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });

    this.ws.on("error", (err) => {
      this.rejectAllPending("WebSocket error");
      this.emit("error", err);
    });
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.connecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  async request<T = unknown>(
    method: string,
    params?: unknown,
    timeoutMs = 30000
  ): Promise<T> {
    if (!this.ws || !this.connected) {
      throw new Error("Not connected to gateway");
    }

    const id = randomUUID();
    const frame: RequestFrame = { type: "req", id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(`Request ${method} (id: ${id}) timed out after ${timeoutMs}ms`)
        );
      }, timeoutMs);

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      try {
        this.ws!.send(JSON.stringify(frame));
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(new Error(`Failed to send ${method}: ${(err as Error).message}`));
      }
    });
  }

  // --- Convenience methods for verified gateway RPC calls ---

  async agentsList() {
    return this.request<{
      defaultId: string;
      mainKey: string;
      scope: string;
      agents: Array<{
        id: string;
        name?: string;
        workspace?: string;
        emoji?: string;
        default?: boolean;
        model?: string | { primary?: string };
      }>;
    }>("agents.list");
  }

  async sessionsList(params?: {
    limit?: number;
    activeMinutes?: number;
    includeGlobal?: boolean;
    includeDerivedTitles?: boolean;
    includeLastMessage?: boolean;
    agentId?: string;
    search?: string;
    spawnedBy?: string;
  }) {
    return this.request("sessions.list", params);
  }

  async sessionsPreview(params: { keys: string[]; limit?: number }) {
    return this.request("sessions.preview", params);
  }

  async sessionsPatch(params: {
    key: string;
    label?: string;
    thinkingLevel?: string;
    model?: string;
  }) {
    return this.request("sessions.patch", params);
  }

  async cronList(params?: { includeDisabled?: boolean }) {
    return this.request<CronJob[]>("cron.list", params);
  }

  async cronRun(params: { id: string; mode?: "due" | "force" }) {
    return this.request("cron.run", params);
  }

  async cronUpdate(params: { id: string; patch: Record<string, unknown> }) {
    return this.request("cron.update", params);
  }

  async cronRuns(params: { id: string; limit?: number }) {
    return this.request<CronRunLogEntry[]>("cron.runs", params);
  }

  async configGet() {
    return this.request("config.get");
  }

  async configUpdate(payload: { raw: string; baseHash: string }) {
    return this.request("config.patch", payload);
  }

  async chatSend(params: {
    sessionKey: string;
    message: string;
    idempotencyKey: string;
    model?: string;
    thinkingLevel?: string;
    workflow?: string;
    skills?: string[];
    attachments?: Array<{
      name: string;
      type: string;
      size: number;
      base64?: string;
    }>;
  }) {
    return this.request("chat.send", params);
  }

  async chatAbort(params: { sessionKey: string; runId?: string }) {
    return this.request("chat.abort", params);
  }

  async chatHistory(params: { sessionKey: string; limit?: number }) {
    return this.request("chat.history", params);
  }

  async modelsList() {
    return this.request("models.list");
  }

  async channelsStatus(params?: { probe?: boolean; timeoutMs?: number }) {
    return this.request("channels.status", params);
  }

  async logsTail(params?: {
    cursor?: number;
    limit?: number;
    maxBytes?: number;
  }) {
    return this.request("logs.tail", params);
  }

  async healthCheck() {
    return this.request("health");
  }

  async systemStatus() {
    return this.request("status");
  }

  async execApprovalsGet() {
    return this.request("exec.approvals.get");
  }

  async execApprovalsResolve(params: { id?: string; sessionKey?: string; resolution: "approved" | "rejected" }) {
    return this.request("exec.approvals.resolve", params);
  }

  async skillsStatus(params?: { agentId?: string }) {
    return this.request("skills.status", params);
  }

  async agentFiles(params: { agentId: string }) {
    return this.request("agents.files", params);
  }

  // sessions.usage does NOT exist. Compute from sessions.list metadata.

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    // Add 10-20% jitter to prevent thundering herd
    const jitter = this.backoffMs * (0.1 + Math.random() * 0.1);
    const delay = this.backoffMs + jitter;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.ws) {
        this.ws.removeAllListeners();
        this.ws = null;
      }
      this.connect();
    }, delay);

    // Exponential backoff: 1s -> 2s -> 4s -> 8s -> ... -> 30s max
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }

  private rejectAllPending(reason: string): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pending.clear();
  }
}
