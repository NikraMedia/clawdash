"use client";

import {
  createContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  type Dispatch,
} from "react";
import { stripRoutingTags } from "@/lib/normalize-content";

// ── Types ───────────────────────────────────────────────────────────────

export interface StreamChatEvent {
  runId: string;
  seq: number;
  state: "delta" | "final" | "error" | "aborted";
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
}

export interface StreamState {
  activeRunId: string | null;
  streamingContent: string;
  isStreaming: boolean;
  lastCompletedSeq: number;
  error: string | null;
  connected: boolean;
}

// ── Actions ─────────────────────────────────────────────────────────────

type StreamAction =
  | { type: "SSE_CONNECTED" }
  | { type: "SSE_DISCONNECTED" }
  | { type: "CHAT_DELTA"; runId: string; seq: number; text: string }
  | { type: "CHAT_FINAL"; runId: string; seq: number }
  | { type: "CHAT_ERROR"; runId: string; seq: number; errorMessage: string }
  | { type: "CHAT_ABORTED"; runId: string; seq: number }
  | { type: "RESET" };

// ── Reducer ─────────────────────────────────────────────────────────────

const initialState: StreamState = {
  activeRunId: null,
  streamingContent: "",
  isStreaming: false,
  lastCompletedSeq: 0,
  error: null,
  connected: false,
};

function streamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case "SSE_CONNECTED":
      return { ...state, connected: true, error: null };

    case "SSE_DISCONNECTED":
      return { ...state, connected: false };

    case "CHAT_DELTA": {
      const content =
        state.activeRunId === action.runId
          ? state.streamingContent + action.text
          : action.text;
      return {
        ...state,
        activeRunId: action.runId,
        streamingContent: content,
        isStreaming: true,
        error: null,
      };
    }

    case "CHAT_FINAL":
      return {
        ...state,
        activeRunId: null,
        streamingContent: "",
        isStreaming: false,
        lastCompletedSeq: action.seq,
      };

    case "CHAT_ERROR":
      return {
        ...state,
        activeRunId: null,
        streamingContent: "",
        isStreaming: false,
        lastCompletedSeq: action.seq,
        error: action.errorMessage,
      };

    case "CHAT_ABORTED":
      return {
        ...state,
        activeRunId: null,
        streamingContent: "",
        isStreaming: false,
        lastCompletedSeq: action.seq,
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// ── Extract text from delta message ─────────────────────────────────────

function extractDeltaText(message: unknown): string {
  if (typeof message === "string") return stripRoutingTags(message);
  if (message && typeof message === "object") {
    const m = message as Record<string, unknown>;
    if (typeof m.text === "string") return stripRoutingTags(m.text);
    // Handle content array shape: [{ type: "text", text: "..." }]
    if (Array.isArray(m.content)) {
      return stripRoutingTags(
        m.content
        .filter(
          (b: unknown) =>
            b && typeof b === "object" && (b as Record<string, unknown>).type === "text"
        )
        .map((b: unknown) => (b as Record<string, unknown>).text ?? "")
        .join("\n\n")
      );
    }
  }
  return "";
}

// ── Context ─────────────────────────────────────────────────────────────

interface SessionStreamContextValue {
  state: StreamState;
  dispatch: Dispatch<StreamAction>;
}

export const SessionStreamContext =
  createContext<SessionStreamContextValue | null>(null);

// ── Hook ────────────────────────────────────────────────────────────────

export function useSessionStream(sessionKey: string) {
  const [state, dispatch] = useReducer(streamReducer, initialState);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);

  const connect = useCallback(function doConnect() {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource(`/api/sessions/${encodeURIComponent(sessionKey)}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("connected", () => {
      dispatch({ type: "SSE_CONNECTED" });
      backoffRef.current = 1000; // reset backoff
    });

    es.addEventListener("chat", (e: MessageEvent) => {
      try {
        const data: StreamChatEvent = JSON.parse(e.data);

        switch (data.state) {
          case "delta":
            dispatch({
              type: "CHAT_DELTA",
              runId: data.runId,
              seq: data.seq,
              text: extractDeltaText(data.message),
            });
            break;

          case "final":
            dispatch({
              type: "CHAT_FINAL",
              runId: data.runId,
              seq: data.seq,
            });
            break;

          case "error":
            dispatch({
              type: "CHAT_ERROR",
              runId: data.runId,
              seq: data.seq,
              errorMessage: data.errorMessage ?? "Stream error",
            });
            break;

          case "aborted":
            dispatch({ type: "CHAT_ABORTED", runId: data.runId, seq: data.seq });
            break;
        }
      } catch {
        // malformed event — ignore
      }
    });

    // ping events are keep-alive, no dispatch needed

    es.onerror = () => {
      dispatch({ type: "SSE_DISCONNECTED" });
      es.close();
      eventSourceRef.current = null;

      // Reconnect with exponential backoff
      const delay = backoffRef.current + Math.random() * 500;
      backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
      reconnectTimerRef.current = setTimeout(() => doConnect(), delay);
    };
  }, [sessionKey]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      dispatch({ type: "RESET" });
    };
  }, [connect]);

  return { state, dispatch };
}

export const __testables = {
  initialState,
  streamReducer,
  extractDeltaText,
};
