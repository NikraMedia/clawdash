import { describe, expect, test } from "vitest";
import {
    getSessionTitle,
    generatePreviewText,
    isUsefulTitle,
    generateFallbackTitle,
} from "../session-utils";
import type { SessionRow } from "@/lib/gateway/types";

type PartialSession = Partial<SessionRow>;

describe("isUsefulTitle", () => {
    test("rejects empty and whitespace strings", () => {
        expect(isUsefulTitle("")).toBe(false);
        expect(isUsefulTitle("   ")).toBe(false);
        expect(isUsefulTitle(undefined)).toBe(false);
    });

    test("rejects known junk prefixes", () => {
        expect(isUsefulTitle("Conversation info for agent:main")).toBe(false);
        expect(isUsefulTitle("system: internal event")).toBe(false);
        expect(isUsefulTitle("```json\n{}```")).toBe(false);
    });

    test("rejects hex hash strings", () => {
        expect(isUsefulTitle("a1b2c3d4e5f6")).toBe(false);
        expect(isUsefulTitle("a1b2c3d4 (2026-01-01)")).toBe(false);
    });

    test("accepts normal titles", () => {
        expect(isUsefulTitle("Fix the login page")).toBe(true);
        expect(isUsefulTitle("Debug session timeout")).toBe(true);
    });
});

describe("getSessionTitle", () => {
    test("returns label when present and useful", () => {
        const s: PartialSession = { label: "Fix the login bug", key: "agent:main:123" };
        expect(getSessionTitle(s)).toBe("Fix the login bug");
    });

    test("strips markdown and filler from label", () => {
        const s: PartialSession = { label: "hey, can you **fix** the bug?", key: "agent:main:123" };
        const title = getSessionTitle(s);
        expect(title).not.toContain("**");
        expect(title).not.toMatch(/^hey/i);
        expect(title).not.toMatch(/^can you/i);
        expect(title).toBe("Fix the bug?");
    });

    test("prefers derivedTitle over lastMessagePreview", () => {
        const s: PartialSession = {
            derivedTitle: "Project Architecture Review",
            lastMessagePreview: "Can you review the architecture?",
            key: "agent:main:123",
        };
        expect(getSessionTitle(s)).toBe("Project Architecture Review");
    });

    test("truncates on word boundary for long previews", () => {
        const longMsg = "Implement the new authentication system with OAuth2 integration and multi-factor support plus email verification";
        const s: PartialSession = { lastMessagePreview: longMsg, key: "agent:main:123" };
        const title = getSessionTitle(s);
        expect(title.length).toBeLessThanOrEqual(65); // 60 + ellipsis
        expect(title).toContain("…");
        // The text before the ellipsis should end at a word boundary
        const textPart = title.replace("…", "").trim();
        expect(textPart).toMatch(/\w$/); // ends on a complete word
        expect(textPart.split(" ").pop()!.length).toBeGreaterThan(1); // not a fragment
    });

    test("uses origin metadata as fallback", () => {
        const s: PartialSession = {
            key: "agent:main:123",
            origin: { surface: "Slack", chatType: "channel", from: "#general" },
        };
        expect(getSessionTitle(s)).toBe("Slack · channel · #general");
    });

    test("uses subject as fallback", () => {
        const s: PartialSession = {
            key: "agent:main:123",
            subject: "Weekly standup notes",
        };
        expect(getSessionTitle(s)).toBe("Weekly standup notes");
    });

    test("falls back to generateFallbackTitle for key-only sessions", () => {
        const s: PartialSession = { key: "agent:main:1700000000000" };
        const title = getSessionTitle(s);
        expect(title).toContain("Main");
    });
});

describe("generateFallbackTitle", () => {
    test("parses agent name and time from key", () => {
        const title = generateFallbackTitle("agent:projectbot:1700000000000");
        expect(title).toContain("Projectbot");
    });

    test("handles hex-only keys", () => {
        const title = generateFallbackTitle("a1b2c3d4e5f6a1b2");
        expect(title).toBe("Session a1b2c3d4");
    });
});

describe("generatePreviewText", () => {
    test("returns cleaned preview text", () => {
        const s: PartialSession = {
            lastMessagePreview: "**Hello**, can you help me debug the `session` timeout issue?",
        };
        const preview = generatePreviewText(s);
        expect(preview).not.toBeNull();
        expect(preview).not.toContain("**");
        expect(preview).not.toContain("`");
    });

    test("returns null for empty or junk input", () => {
        expect(generatePreviewText({})).toBeNull();
        expect(generatePreviewText({ lastMessagePreview: "" })).toBeNull();
        expect(generatePreviewText({ lastMessagePreview: "  " })).toBeNull();
        expect(generatePreviewText({ lastMessagePreview: "ab" })).toBeNull();
    });

    test("truncates long previews on word boundary", () => {
        const long = "This is a very long preview message that should be truncated at a word boundary to avoid cutting words in half and making the text hard to read in the sidebar";
        const preview = generatePreviewText({ lastMessagePreview: long })!;
        expect(preview.length).toBeLessThanOrEqual(90); // 80 + ellipsis leeway
        expect(preview).toContain("…");
    });
});
