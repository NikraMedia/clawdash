import { createServer } from "http";
import next from "next";
import { parse } from "url";
import { getGateway } from "./src/lib/gateway";
import { getCollector } from "./src/lib/collector";
import { getChatStreamBroker } from "./src/lib/chat-stream-broker";

const port = parseInt(process.env.CLAW_DASH_PORT || "3939", 10);
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Initialize gateway connection before accepting requests
  const gateway = getGateway();
  const collector = getCollector();
  const chatBroker = getChatStreamBroker();

  gateway.on("connected", (hello) => {
    console.log(
      `[claw-dash] Gateway connected — v${hello.server.version}, ${hello.features.methods.length} methods, ${hello.features.events.length} events`
    );
  });

  gateway.on("disconnected", () => {
    console.log("[claw-dash] Gateway disconnected — will reconnect");
  });

  gateway.on("error", (err: Error) => {
    console.error("[claw-dash] Gateway error:", err.message);
  });

  // Feed all gateway events into the activity collector
  gateway.on("event", (data: { event: string; payload: unknown }) => {
    collector.push(data.event, data.payload);
  });

  // Feed chat events into the streaming broker for SSE subscribers
  gateway.on("event:chat", (payload: unknown) => {
    if (payload && typeof payload === "object" && "sessionKey" in payload) {
      chatBroker.publish(payload as import("./src/lib/gateway/types").ChatEvent);
    }
  });

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[claw-dash] Port ${port} is already in use`);
    } else {
      console.error("[claw-dash] Server error:", err);
    }
    process.exit(1);
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[claw-dash] Ready on http://localhost:${port}`);
  });

  // Graceful shutdown
  function shutdown(signal: string) {
    console.log(`[claw-dash] ${signal} received — shutting down`);
    gateway.disconnect();
    server.close(() => {
      console.log("[claw-dash] HTTP server closed");
      process.exit(0);
    });
    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      console.error("[claw-dash] Forced exit after 10s timeout");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error("[claw-dash] Unhandled promise rejection:", reason);
  });
}).catch((err) => {
  console.error("[claw-dash] Failed to initialize Next.js:", err);
  process.exit(1);
});
