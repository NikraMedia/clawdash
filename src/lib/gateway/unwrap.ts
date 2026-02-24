import type { CronJob, SessionRow } from "@/types/gateway";

/**
 * Gateway responses wrap arrays inconsistently.
 * These utilities normalize to plain arrays.
 */

export function unwrapCronJobs(data: unknown): CronJob[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as CronJob[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.jobs)) return obj.jobs as CronJob[];
  return [];
}

export function unwrapSessions(data: unknown): SessionRow[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as SessionRow[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.sessions)) return obj.sessions as SessionRow[];
  return [];
}

export function unwrapChannels(
  data: unknown
): Record<string, unknown> {
  if (!data) return {};
  const obj = data as Record<string, unknown>;
  // channels.status returns { channels: {...}, channelOrder: [...] }
  if (obj.channels && typeof obj.channels === "object" && !Array.isArray(obj.channels)) {
    return obj.channels as Record<string, unknown>;
  }
  return obj;
}

export function unwrapMessages(
  data: unknown
): Array<{ role: string; content?: unknown; text?: string; ts?: number }> {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.messages)) return obj.messages;
  return [];
}
