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
    if (isUsefulTitle(s.label)) return s.label;
    if (isUsefulTitle(s.derivedTitle)) return s.derivedTitle;
    if (isUsefulTitle(s.lastMessagePreview)) {
        const preview = stripMarkdown(stripRoutingTags(s.lastMessagePreview));
        if (preview) return preview.length > 60 ? preview.slice(0, 57) + "..." : preview;
    }
    if (isUsefulTitle(s.displayName)) return s.displayName;
    if (!s.key) return "Unknown Session";
    return generateFallbackTitle(s.key);
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
