import { getChatStreamBroker } from "@/lib/chat-stream-broker";
import type { ChatEvent } from "@/lib/gateway/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key: sessionKey } = await params;

  const broker = getChatStreamBroker();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (eventName: string, data: unknown) => {
        const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // stream already closed by client
        }
      };

      // Send initial heartbeat so the client knows the connection is live
      send("connected", { sessionKey, ts: Date.now() });

      const onChat = (event: ChatEvent) => {
        send("chat", {
          runId: event.runId,
          seq: event.seq,
          state: event.state,
          message: event.message,
          errorMessage: event.errorMessage,
          usage: event.usage,
          stopReason: event.stopReason,
        });
      };

      const unsubscribe = broker.subscribe(sessionKey, onChat);

      // Keep-alive ping every 30s to prevent proxy/browser timeouts
      const keepAlive = setInterval(() => {
        send("ping", { ts: Date.now() });
      }, 30_000);

      // Cleanup when the client disconnects
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
