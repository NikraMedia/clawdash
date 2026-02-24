// Server-side pub/sub broker for chat streaming events.
// Subscribes SSE routes to gateway chat events keyed by session.
// Singleton via globalThis — survives Next.js Fast Refresh in dev.

import type { ChatEvent } from "./gateway/types";

type ChatEventListener = (event: ChatEvent) => void;

export class ChatStreamBroker {
  private listeners = new Map<string, Set<ChatEventListener>>();

  /**
   * Publish a chat event from the gateway. Routes to all listeners
   * subscribed to the event's sessionKey.
   */
  publish(event: ChatEvent): void {
    const subs = this.listeners.get(event.sessionKey);
    if (!subs || subs.size === 0) return;
    for (const cb of subs) {
      try {
        cb(event);
      } catch (err) {
        console.error("[claw-dash] Chat broker listener error:", err);
      }
    }
  }

  /**
   * Subscribe to chat events for a specific session.
   * Returns an unsubscribe function.
   */
  subscribe(sessionKey: string, cb: ChatEventListener): () => void {
    let subs = this.listeners.get(sessionKey);
    if (!subs) {
      subs = new Set();
      this.listeners.set(sessionKey, subs);
    }
    subs.add(cb);

    return () => {
      subs!.delete(cb);
      if (subs!.size === 0) {
        this.listeners.delete(sessionKey);
      }
    };
  }

  /** Number of active session subscriptions (for diagnostics). */
  get activeSessionCount(): number {
    return this.listeners.size;
  }
}

// Singleton via globalThis
const globalForBroker = globalThis as unknown as {
  __clawDashChatBroker?: ChatStreamBroker;
};

export function getChatStreamBroker(): ChatStreamBroker {
  if (!globalForBroker.__clawDashChatBroker) {
    globalForBroker.__clawDashChatBroker = new ChatStreamBroker();
  }
  return globalForBroker.__clawDashChatBroker;
}
