// In-memory event collector for the activity stream.
// Subscribes to gateway events and stores them in a ring buffer.
// Server-side only — no "use client".

export type Severity = "info" | "warning" | "error";

export interface CollectedEvent {
  id: number;
  event: string;
  payload: unknown;
  timestamp: number;
  severity: Severity;
  agentId: string | undefined;
}

export interface QueryOpts {
  showAll?: boolean;
  agentId?: string;
  eventType?: string;
  severity?: string;
  limit?: number;
}

const MAX_EVENTS = 1000;

// Events that are hidden by default (noise reduction)
const HIDDEN_EVENTS = new Set(["tick", "presence"]);

// Chat states that pass through the default filter
const CHAT_SHOW_STATES = new Set(["final", "error", "aborted"]);

/**
 * Classify the severity of a gateway event.
 */
function classifySeverity(event: string, payload: unknown): Severity {
  // Error: event name contains "error", or payload has an error field
  if (event.includes("error")) return "error";
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if ("error" in p && p.error) return "error";
    if ("errorMessage" in p && p.errorMessage) return "error";
    if ("state" in p && p.state === "error") return "error";
  }

  // Warning: shutdown, exec approval requests, or warning indicators in payload
  if (event === "shutdown") return "warning";
  if (event === "exec.approval.requested") return "warning";
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if ("warning" in p && p.warning) return "warning";
    if ("lastStatus" in p && p.lastStatus === "error") return "warning";
    if ("consecutiveErrors" in p && (p.consecutiveErrors as number) > 0)
      return "warning";
  }

  return "info";
}

/**
 * Extract agentId from payload when present.
 */
function extractAgentId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const p = payload as Record<string, unknown>;
  if (typeof p.agentId === "string") return p.agentId;
  if (typeof p.agent === "string") return p.agent;
  // Cron events embed agentId in the job metadata
  if (typeof p.jobId === "string" && typeof p.agentId === "string")
    return p.agentId;
  return undefined;
}

/**
 * Smart default filter: determines whether an event should be shown
 * in the default (non-showAll) view.
 */
function passesDefaultFilter(event: CollectedEvent): boolean {
  const name = event.event;

  // Always hide noise events
  if (HIDDEN_EVENTS.has(name)) return false;

  // Health events: only show if they carry errors/warnings
  if (name === "health") {
    return event.severity !== "info";
  }

  // Chat events: only show final, error, aborted
  if (name === "chat") {
    if (event.payload && typeof event.payload === "object") {
      const state = (event.payload as Record<string, unknown>).state;
      if (typeof state === "string") return CHAT_SHOW_STATES.has(state);
    }
    // If no state field, show it (unexpected shape)
    return true;
  }

  // Agent events: only show errors
  if (name === "agent") {
    return event.severity !== "info";
  }

  // Everything else passes: cron, shutdown, exec.approval.*, update.available, etc.
  return true;
}

export class EventCollector {
  private buffer: CollectedEvent[] = [];
  private nextId = 1;
  private cachedEventTypes: string[] | null = null;
  private cachedAgentIds: string[] | null = null;

  /**
   * Push a new event into the ring buffer.
   */
  push(event: string, payload: unknown): void {
    const severity = classifySeverity(event, payload);
    const agentId = extractAgentId(payload);

    const entry: CollectedEvent = {
      id: this.nextId++,
      event,
      payload,
      timestamp: Date.now(),
      severity,
      agentId,
    };

    this.buffer.push(entry);

    // Invalidate computed caches
    this.cachedEventTypes = null;
    this.cachedAgentIds = null;

    // Ring buffer: trim from the front when exceeding max
    if (this.buffer.length > MAX_EVENTS) {
      this.buffer.splice(0, this.buffer.length - MAX_EVENTS);
    }
  }

  /**
   * Query events with optional filters.
   */
  getEvents(opts?: QueryOpts): CollectedEvent[] {
    const {
      showAll = false,
      agentId,
      eventType,
      severity,
      limit = 100,
    } = opts ?? {};

    let result = this.buffer;

    // Apply default filter unless showAll
    if (!showAll) {
      result = result.filter(passesDefaultFilter);
    }

    // Filter by agent
    if (agentId) {
      result = result.filter((e) => e.agentId === agentId);
    }

    // Filter by event type
    if (eventType) {
      result = result.filter((e) => e.event === eventType);
    }

    // Filter by severity
    if (severity) {
      result = result.filter((e) => e.severity === severity);
    }

    // Return most recent first, capped at limit
    return result.slice(-limit).reverse();
  }

  /**
   * Get the total count of events in the buffer (for diagnostics).
   */
  get size(): number {
    return this.buffer.length;
  }

  /**
   * Get the set of unique event names in the buffer.
   */
  get eventTypes(): string[] {
    if (!this.cachedEventTypes) {
      this.cachedEventTypes = [...new Set(this.buffer.map((e) => e.event))].sort();
    }
    return this.cachedEventTypes;
  }

  /**
   * Get the set of unique agent IDs in the buffer.
   */
  get agentIds(): string[] {
    if (!this.cachedAgentIds) {
      this.cachedAgentIds = [
        ...new Set(
          this.buffer.map((e) => e.agentId).filter((id): id is string => !!id)
        ),
      ].sort();
    }
    return this.cachedAgentIds;
  }
}

// Singleton via globalThis — survives Next.js Fast Refresh in dev
const globalForCollector = globalThis as unknown as {
  __clawDashCollector?: EventCollector;
};

export function getCollector(): EventCollector {
  if (!globalForCollector.__clawDashCollector) {
    globalForCollector.__clawDashCollector = new EventCollector();
  }
  return globalForCollector.__clawDashCollector;
}
