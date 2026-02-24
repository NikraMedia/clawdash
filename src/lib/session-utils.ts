import type { SessionRow } from "@/lib/gateway/types";

// Re-export for consumers that import from session-utils
export type { SessionRow };

// Re-export compact formatter for backward compatibility with sidebar imports
export { formatRelativeTimeCompact as formatRelativeTime } from "./format";

export function isUsefulTitle(title: string | undefined): title is string {
    if (!title || !title.trim()) return false;
    const lower = title.toLowerCase();
    if (lower.startsWith("conversation info")) return false;
    if (lower.startsWith("system:")) return false;
    if (lower.includes("untrusted metadata")) return false;
    if (lower.startsWith("```")) return false;
    if (/^[0-9a-f]{6,}(\s*\(|$)/i.test(title.trim())) return false;
    return true;
}

/** Truncate text at a word boundary, appending ellipsis if needed. */
function truncateOnWord(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const truncated = text.slice(0, maxLen);
    const lastSpace = truncated.lastIndexOf(" ");
    const cutPoint = lastSpace > maxLen * 0.4 ? lastSpace : maxLen;
    return truncated.slice(0, cutPoint).replace(/[,;:\s]+$/, "") + "…";
}

/** Strip leading filler words/greetings from a message to get to the intent. */
function stripFillerPrefix(text: string): string {
    const pattern = /^(hey|hi|hello|yo|ok|okay|sure|please|can you|could you|i need you to|i want you to|i'd like you to)[,!.:\s]*/i;
    let result = text;
    let prev = "";
    while (result !== prev) {
        prev = result;
        result = result.replace(pattern, "");
    }
    return result.replace(/^\s+/, "");
}

/** Clean raw message text into a presentable title. */
function cleanForTitle(raw: string): string {
    const cleaned = stripFillerPrefix(stripMarkdown(stripRoutingTags(raw))).trim();
    if (!cleaned) return "";
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function stripRoutingTags(text: string): string {
    return text.replace(/\[\[[^\]]+\]\]\s*/g, "").trim();
}

export function stripMarkdown(text: string): string {
    return text
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/_([^_]+)_/g, "$1")
        .replace(/~~([^~]+)~~/g, "$1")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/^[-*+]\s+/gm, "")
        .replace(/^\d+\.\s+/gm, "")
        .replace(/^>\s+/gm, "")
        .replace(/^-{3,}$/gm, "")
        .replace(/\n{2,}/g, " ")
        .replace(/\n/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
}

export function getSessionTitle(s: Partial<SessionRow>): string {
    if (isUsefulTitle(s.label)) {
        const cleaned = cleanForTitle(s.label);
        if (cleaned) return truncateOnWord(cleaned, 60);
    }
    if (isUsefulTitle(s.derivedTitle)) return s.derivedTitle;
    if (isUsefulTitle(s.lastMessagePreview)) {
        const cleaned = cleanForTitle(s.lastMessagePreview);
        if (cleaned) return truncateOnWord(cleaned, 60);
    }
    // Try origin metadata (e.g., "Slack · #general", "CLI")
    const originTitle = buildOriginTitle(s);
    if (originTitle) return originTitle;
    if (isUsefulTitle(s.displayName)) return s.displayName;
    if (isUsefulTitle(s.subject)) return truncateOnWord(s.subject, 60);
    if (!s.key) return "Unknown Session";
    return generateFallbackTitle(s.key);
}

/** Build a title from origin metadata when no better title exists. */
function buildOriginTitle(s: Partial<SessionRow>): string | null {
    const origin = s.origin;
    if (!origin) return null;
    if (isUsefulTitle(origin.label)) return origin.label;
    const parts: string[] = [];
    if (origin.surface) parts.push(origin.surface);
    if (origin.chatType && origin.chatType !== "direct") parts.push(origin.chatType);
    if (origin.from) parts.push(origin.from);
    if (parts.length > 0) return parts.join(" · ");
    return null;
}

/**
 * Generate a 1-line preview from lastMessagePreview for display
 * beneath the title in the sidebar. Returns null if nothing useful.
 */
export function generatePreviewText(s: Partial<SessionRow>): string | null {
    const raw = s.lastMessagePreview;
    if (!raw || !raw.trim()) return null;
    const cleaned = stripMarkdown(stripRoutingTags(raw)).trim();
    if (!cleaned || cleaned.length < 3) return null;
    return truncateOnWord(cleaned, 80);
}

export function generateFallbackTitle(key: string): string {
    const parts = key.split(":");
    if (parts.length >= 2) {
        const agentName = parts[1];
        const tsStr = parts[parts.length - 1];
        const ts = Number(tsStr);
        if (!isNaN(ts) && ts > 1_000_000_000_000) {
            const d = new Date(ts);
            const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
            const displayAgent = agentName.charAt(0).toUpperCase() + agentName.slice(1);
            return `${displayAgent} \u00b7 ${time}`;
        }
        return agentName.charAt(0).toUpperCase() + agentName.slice(1);
    }
    if (/^[0-9a-f]{6,}$/i.test(key)) {
        return `Session ${key.slice(0, 8)}`;
    }
    const hashDateMatch = key.match(/^([0-9a-f]+)\s*\((.+)\)$/i);
    if (hashDateMatch) {
        return `Session \u00b7 ${hashDateMatch[2]}`;
    }
    return key.length > 40 ? key.slice(0, 37) + "..." : key;
}

export type TimeGroup = "Today" | "Yesterday" | "This Week" | "Older";

export function getTimeGroup(ms: number | null): TimeGroup {
    if (!ms) return "Older";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86_400_000;
    const startOfWeek = startOfToday - (now.getDay() * 86_400_000);

    if (ms >= startOfToday) return "Today";
    if (ms >= startOfYesterday) return "Yesterday";
    if (ms >= startOfWeek) return "This Week";
    return "Older";
}
