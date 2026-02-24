import { expect, test } from "vitest";
import { __testables } from "./use-session-stream";

const { initialState, streamReducer, extractDeltaText } = __testables;

test("CHAT_ERROR updates completion sequence so history refetch can trigger", () => {
  const next = streamReducer(initialState, {
    type: "CHAT_ERROR",
    runId: "run-1",
    seq: 7,
    errorMessage: "boom",
  });

  expect(next.lastCompletedSeq).toBe(7);
  expect(next.isStreaming).toBe(false);
  expect(next.streamingContent).toBe("");
  expect(next.error).toBe("boom");
});

test("CHAT_ABORTED updates completion sequence so history refetch can trigger", () => {
  const next = streamReducer(initialState, {
    type: "CHAT_ABORTED",
    runId: "run-1",
    seq: 8,
  });

  expect(next.lastCompletedSeq).toBe(8);
  expect(next.isStreaming).toBe(false);
  expect(next.streamingContent).toBe("");
});

test("extractDeltaText strips leading routing tags from string and object payloads", () => {
  expect(extractDeltaText("[[reply_to_current]] hello")).toBe("hello");
  expect(extractDeltaText({ text: "[[routing:direct]] world" })).toBe("world");
  expect(
    extractDeltaText({
      content: [{ type: "text", text: "[[agent:main]] one" }, { type: "text", text: " two" }],
    })
  ).toBe("one\n\n two");
});
