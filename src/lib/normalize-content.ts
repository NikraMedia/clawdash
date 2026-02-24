export type ParsedEventType =
  | "text"
  | "thought"
  | "tool_call"
  | "tool_result"
  | "delegation"
  | "approval"
  | "unknown";

export interface ParsedEvent {
  id: string;
  type: ParsedEventType;
  isPending?: boolean;
  timestampMs?: number;
  payload: unknown;
}

export interface ThoughtPayload {
  rawText: string;
  tokenCountEstimate?: number;
}

export interface ToolCallPayload {
  toolName: string;
  arguments: Record<string, unknown>;
  result?: string | Record<string, unknown>;
  error?: string;
}

export interface ToolResultPayload {
  toolName?: string;
  toolUseId?: string;
  result: unknown;
  error?: string;
}

export interface DelegationPayload {
  agentId: string;
  roleDescription: string;
  status: "spinning_up" | "active" | "completed";
  handoffSummary?: string;
  nestedEvents?: ParsedEvent[];
}

export interface ApprovalPayload {
  actionDescription: string;
  resolution?: "approved" | "rejected";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Re-export canonical stripRoutingTags from session-utils
import { stripRoutingTags } from "@/lib/session-utils";
export { stripRoutingTags };

/**
 * Safely serialize a payload for the unknown event fallback.
 * Prevents circular references or non-serializable values from crashing React.
 */
function safePayload(value: unknown): unknown {
  try {
    // Round-trip through JSON to strip non-serializable values
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { _raw: String(value) };
  }
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : { raw: parsed };
  } catch {
    return { raw: value };
  }
}

function parseDelegationStatus(value: unknown): DelegationPayload["status"] {
  const status = typeof value === "string" ? value.toLowerCase() : "";
  if (status.includes("complete") || status.includes("done") || status.includes("finish")) {
    return "completed";
  }
  if (status.includes("spin") || status.includes("pending") || status.includes("start")) {
    return "spinning_up";
  }
  return "active";
}

function parseApprovalResolution(value: unknown): ApprovalPayload["resolution"] {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (["approved", "approve", "accepted", "allow", "allowed", "ok"].includes(normalized)) {
    return "approved";
  }
  if (["rejected", "reject", "denied", "deny", "blocked"].includes(normalized)) {
    return "rejected";
  }
  return undefined;
}

/**
 * Merge consecutive "text" events into a single event.
 * Gateway content arrays often deliver one `{type:"text"}` block per
 * paragraph or content fragment. Rendering each in its own ReactMarkdown
 * instance breaks cross-block formatting (code fences, headings, lists).
 * Joining with `\n\n` preserves markdown paragraph breaks.
 */
function coalesceTextEvents(events: ParsedEvent[], fallbackId: string): ParsedEvent[] {
  const result: ParsedEvent[] = [];
  let textBuffer: string[] = [];
  let firstTextId: string | null = null;

  const flush = () => {
    if (textBuffer.length === 0) return;
    result.push({
      id: firstTextId ?? `${fallbackId}-text-merged`,
      type: "text",
      payload: textBuffer.join("\n\n"),
    });
    textBuffer = [];
    firstTextId = null;
  };

  for (const event of events) {
    if (event.type === "text") {
      if (firstTextId === null) firstTextId = event.id;
      textBuffer.push(String(event.payload));
    } else {
      flush();
      result.push(event);
    }
  }
  flush();

  return result;
}

/**
 * Parses raw message content into an array of structured ParsedEvents.
 */
export function parseEvents(content: unknown, fallbackId: string = Math.random().toString(36).slice(2)): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  let textEventCounter = 0;

  const parseObjectEvent = (obj: Record<string, unknown>, idx: number) => {
    if (obj.type === "tool_use" || obj.type === "toolCall") {
      events.push({
        id: (obj.id as string) || `${fallbackId}-tool-${idx}`,
        type: "tool_call",
        payload: {
          toolName: (obj.name as string) || (obj.toolName as string) || "unknown",
          arguments: (obj.input as Record<string, unknown>) || (obj.arguments as Record<string, unknown>) || {},
        } as ToolCallPayload
      });
      return;
    }

    if (obj.type === "tool_result" || obj.type === "toolResult") {
      events.push({
        id: (obj.tool_use_id as string) || (obj.toolCallId as string) || `${fallbackId}-result-${idx}`,
        type: "tool_result",
        payload: {
          toolName: (obj.name as string) || (obj.toolName as string) || undefined,
          toolUseId: (obj.tool_use_id as string) || (obj.toolCallId as string) || undefined,
          result: obj.content || obj.output || obj,
          error: obj.is_error ? String(obj.content ?? obj.error ?? "") : (obj.error as string | undefined),
        } as ToolResultPayload
      });
      return;
    }

    // Handle thinking/reasoning blocks delivered as objects
    if (obj.type === "thinking" || obj.type === "reasoning") {
      const rawText = String(obj.thinking ?? obj.reasoning ?? obj.content ?? obj.text ?? "");
      if (rawText) {
        events.push({
          id: (obj.id as string) || `${fallbackId}-thought-${idx}`,
          type: "thought",
          payload: { rawText } as ThoughtPayload,
        });
        return;
      }
    }

    if ("text" in obj) {
      parseTextWithThoughts(stripRoutingTags(String(obj.text)));
      return;
    }

    if ("tool_calls" in obj && Array.isArray(obj.tool_calls)) {
      (obj.tool_calls as Array<Record<string, unknown>>).forEach((tc: Record<string, unknown>, tcIdx: number) => {
        const fn = tc.function as Record<string, unknown> | undefined;
        events.push({
          id: (tc.id as string) || `${fallbackId}-tool-${idx}-${tcIdx}`,
          type: "tool_call",
          payload: {
            toolName: (fn?.name as string) || "unknown",
            arguments: parseToolArguments(fn?.arguments)
          } as ToolCallPayload
        });
      });
      return;
    }

    const maybeDelegationType = typeof obj.type === "string"
      && ["delegation", "delegate", "sub_agent_delegation", "agent_delegation"].includes(obj.type.toLowerCase());
    const hasDelegationFields = "agentId" in obj || "agent_id" in obj || "roleDescription" in obj || "role" in obj;

    if (maybeDelegationType || hasDelegationFields) {
      const nestedSource = Array.isArray(obj.nestedEvents)
        ? obj.nestedEvents
        : Array.isArray(obj.events)
          ? obj.events
          : undefined;

      const nestedEvents = nestedSource ? parseEvents(nestedSource, `${fallbackId}-delegation-${idx}`) : undefined;
      const delegationPayload: DelegationPayload = {
        agentId: String(obj.agentId ?? obj.agent_id ?? obj.agent ?? "unknown-agent"),
        roleDescription: String(obj.roleDescription ?? obj.role_description ?? obj.role ?? ""),
        status: parseDelegationStatus(obj.status),
        handoffSummary: obj.handoffSummary != null
          ? String(obj.handoffSummary)
          : obj.handoff_summary != null
            ? String(obj.handoff_summary)
            : obj.summary != null
              ? String(obj.summary)
              : undefined,
        nestedEvents,
      };

      events.push({
        id: (obj.id as string) || `${fallbackId}-delegation-${idx}`,
        type: "delegation",
        payload: delegationPayload
      });
      return;
    }

    const maybeApprovalType = typeof obj.type === "string"
      && [
        "approval",
        "approval_req",
        "approval_request",
        "exec.approval.requested",
        "exec.approval.resolved"
      ].includes(obj.type.toLowerCase());
    const hasApprovalFields = "actionDescription" in obj || "action" in obj || "resolution" in obj || "approval" in obj;

    if (maybeApprovalType || hasApprovalFields) {
      const resolution = parseApprovalResolution(obj.resolution ?? obj.status ?? obj.decision ?? obj.result);
      const approvalPayload: ApprovalPayload = {
        actionDescription: String(
          obj.actionDescription
            ?? obj.action_description
            ?? obj.action
            ?? obj.description
            ?? "Approval required"
        ),
        resolution,
      };

      events.push({
        id: (obj.id as string) || `${fallbackId}-approval-${idx}`,
        type: "approval",
        payload: approvalPayload
      });
      return;
    }

    // Handle OpenAI function_call format (single function call on a message)
    if ("function_call" in obj && isRecord(obj.function_call)) {
      const fn = obj.function_call;
      events.push({
        id: (obj.id as string) || `${fallbackId}-tool-${idx}`,
        type: "tool_call",
        payload: {
          toolName: (fn.name as string) || "unknown",
          arguments: parseToolArguments(fn.arguments),
        } as ToolCallPayload
      });
      return;
    }

    // Handle nested content array (gateway sometimes wraps content blocks in a message envelope)
    if ("content" in obj && Array.isArray(obj.content) && obj.role) {
      const nestedContent = obj.content as unknown[];
      nestedContent.forEach((block, blockIdx) => {
        if (isRecord(block)) {
          parseObjectEvent(block, blockIdx);
        } else if (typeof block === "string") {
          parseTextWithThoughts(block);
        }
      });
      return;
    }

    events.push({
      id: `${fallbackId}-unknown-${idx}`,
      type: "unknown",
      payload: safePayload(obj),
    });
  };

  const parseTextWithThoughts = (text: string) => {
    const cleaned = stripRoutingTags(text);
    const parts = cleaned.split(/(<think>[\s\S]*?<\/think>)/g);
    for (const part of parts) {
      if (!part) continue;
      const currentIndex = textEventCounter++;
      if (part.startsWith("<think>") && part.endsWith("</think>")) {
        // Push the thought
        const thoughtText = part.slice(7, -8).trim();
        events.push({
          id: `${fallbackId}-thought-${currentIndex}`,
          type: "thought",
          payload: { rawText: thoughtText } as ThoughtPayload
        });
      } else if (part.trim()) {
        events.push({
          id: `${fallbackId}-text-${currentIndex}`,
          type: "text",
          payload: part
        });
      }
    }
  };

  if (content == null) return [];

  if (typeof content === "string") {
    parseTextWithThoughts(content);
    return events;
  }

  if (Array.isArray(content)) {
    content.forEach((block, idx) => {
      try {
        if (typeof block === "string") {
          parseTextWithThoughts(block);
        } else if (isRecord(block)) {
          parseObjectEvent(block, idx);
        } else if (block != null) {
          events.push({
            id: `${fallbackId}-unknown-${idx}`,
            type: "unknown",
            payload: safePayload(block),
          });
        }
      } catch {
        events.push({
          id: `${fallbackId}-unknown-${idx}`,
          type: "unknown",
          payload: safePayload(block),
        });
      }
    });

    // Coalesce consecutive text events into a single event so the markdown
    // parser receives a complete document instead of isolated fragments.
    // Without this, code fences, headings, and lists that span multiple
    // content blocks render as unformatted text.
    return coalesceTextEvents(events, fallbackId);
  }

  if (isRecord(content)) {
    try {
      parseObjectEvent(content, 0);
    } catch {
      events.push({
        id: `${fallbackId}-unknown-0`,
        type: "unknown",
        payload: safePayload(content),
      });
    }
    return events;
  }

  events.push({
    id: `${fallbackId}-text`,
    type: "text",
    payload: String(content)
  });

  return events;
}

/**
 * Legacy normalization stringify wrapper.
 */
export function normalizeContent(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object" && "text" in block) {
          return String((block as { text: unknown }).text ?? "");
        }
        return JSON.stringify(block);
      })
      .join("\n\n");
  }

  if (typeof content === "object") {
    if ("text" in content) {
      return String((content as { text: unknown }).text ?? "");
    }
    return JSON.stringify(content, null, 2);
  }

  return String(content);
}
