/**
 * Shared formatting utilities for time, duration, and timestamps.
 * Single source of truth — all components should import from here.
 */

/**
 * Format a past timestamp as relative time.
 * Returns: "just now", "5s ago", "3m ago", "2h ago", "5d ago"
 */
export function formatRelativeTime(ms: number | null | undefined): string {
  if (ms == null) return "\u2014";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1_000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * Format a past timestamp as compact relative time (no "ago" suffix).
 * Returns: "now", "5m", "2h", "3d"
 * Used in sidebar and other space-constrained contexts.
 */
export function formatRelativeTimeCompact(ms: number | null | undefined): string {
  if (ms == null) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

/**
 * Format a future timestamp as relative time.
 * Returns: "overdue", "< 1m", "in 5m", "in 2h", "in 3d"
 */
export function formatFutureTime(ms: number | null | undefined): string {
  if (ms == null) return "\u2014";
  const diff = ms - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 60_000) return "< 1m";
  if (diff < 3_600_000) return `in ${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `in ${Math.floor(diff / 3_600_000)}h`;
  return `in ${Math.floor(diff / 86_400_000)}d`;
}

/**
 * Format a duration in milliseconds.
 * Returns: "500ms", "1.5s", "2.5m"
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "\u2014";
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

/**
 * Format elapsed time since a past timestamp.
 * Returns: "just started", "5m", "2h 5m"
 * Used for active session duration display.
 */
export function formatElapsed(ms: number | null | undefined): string {
  if (ms == null) return "\u2014";
  const diff = Date.now() - ms;
  if (diff < 0) return "just started";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

/**
 * Format an uptime duration in milliseconds as human-readable.
 * Returns: "5d 2h 30m", "3h 15m", "12m 5s", "45s"
 */
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Format a timestamp as a locale datetime string.
 * Returns: "Feb 23, 12:34:56 PM"
 */
export function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Format a token count as a compact human-readable string.
 * Returns: "—" for null/zero, "1.5M" for millions, "12.3k" for thousands, "500" for small values.
 */
export function formatTokens(n?: number | null): string {
  if (n == null || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}
