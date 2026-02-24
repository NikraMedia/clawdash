/**
 * Gateway connectivity probe — validates handshake, auth, and basic RPC.
 * Run: npx tsx scripts/gateway-probe.ts
 *
 * Requires OPENCLAW_GATEWAY_TOKEN env var or reads from ~/.openclaw/.env
 */
import WebSocket from "ws";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

// --- Token resolution ---
function resolveToken(): string {
  if (process.env.OPENCLAW_GATEWAY_TOKEN) {
    return process.env.OPENCLAW_GATEWAY_TOKEN;
  }
  try {
    const envPath = join(process.env.HOME || "", ".openclaw", ".env");
    const envFile = readFileSync(envPath, "utf8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("GATEWAY_AUTH_TOKEN=")) {
        let value = trimmed.slice("GATEWAY_AUTH_TOKEN=".length);
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return value;
      }
    }
  } catch {
    /* fall through */
  }
  throw new Error(
    "No gateway token found. Set OPENCLAW_GATEWAY_TOKEN or check ~/.openclaw/.env"
  );
}

const GATEWAY_URL =
  process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const TOKEN = resolveToken();

console.log(`[probe] Connecting to ${GATEWAY_URL}...`);

const ws = new WebSocket(GATEWAY_URL, {
  headers: { origin: "http://localhost:3939" },
});
let connectReqId: string;

ws.on("open", () => {
  console.log("[probe] WebSocket open. Sending connect handshake...");

  // CRITICAL: Gateway requires a RequestFrame with method "connect",
  // NOT raw ConnectParams. See message-handler.ts:255-261.
  connectReqId = randomUUID();
  const frame = {
    type: "req",
    id: connectReqId,
    method: "connect",
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "openclaw-control-ui",
        displayName: "Claw Dash Probe",
        version: "0.1.0",
        platform: process.platform,
        mode: "probe",
        instanceId: randomUUID().slice(0, 8),
      },
      auth: { token: TOKEN },
      role: "operator",
      scopes: ["operator.read", "operator.write", "operator.admin"],
    },
  };

  ws.send(JSON.stringify(frame));
});

ws.on("message", (data) => {
  const frame = JSON.parse(data.toString());

  if (frame.type === "res" && frame.id === connectReqId) {
    if (!frame.ok) {
      console.error("[probe] HANDSHAKE FAILED:", frame.error);
      ws.close();
      process.exit(1);
    }

    const hello = frame.payload;
    console.log("[probe] HANDSHAKE OK");
    console.log(`  Protocol: ${hello.protocol}`);
    console.log(
      `  Server: ${hello.server.version} (${hello.server.connId})`
    );
    console.log(`  Methods: ${hello.features.methods.length}`);
    console.log(`  Events: ${hello.features.events.length}`);
    console.log(
      `  Uptime: ${Math.round(hello.snapshot.uptimeMs / 1000)}s`
    );
    console.log(`  Auth mode: ${hello.snapshot.authMode || "unknown"}`);

    console.log("\n[probe] Available methods:");
    for (const m of hello.features.methods.sort()) {
      console.log(`  ${m}`);
    }

    console.log("\n[probe] Available events:");
    for (const e of hello.features.events.sort()) {
      console.log(`  ${e}`);
    }

    testRPC();
    return;
  }

  if (frame.type === "res") {
    handleRPCResponse(frame);
    return;
  }

  if (frame.type === "event") {
    console.log(`[probe] Event: ${frame.event}`);
    return;
  }
});

// --- RPC test ---
const pendingRPCs = new Map<
  string,
  { method: string; resolve: (v: unknown) => void }
>();

function callRPC(method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    pendingRPCs.set(id, { method, resolve });
    ws.send(JSON.stringify({ type: "req", id, method, params }));
    setTimeout(() => {
      if (pendingRPCs.has(id)) {
        pendingRPCs.delete(id);
        reject(new Error(`RPC ${method} timed out`));
      }
    }, 10000);
  });
}

function handleRPCResponse(frame: {
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: unknown;
}) {
  const pending = pendingRPCs.get(frame.id);
  if (!pending) return;
  pendingRPCs.delete(frame.id);

  if (frame.ok) {
    console.log(`[probe] RPC ${pending.method}: OK`);
    pending.resolve(frame.payload);
  } else {
    console.error(`[probe] RPC ${pending.method}: FAILED`, frame.error);
    pending.resolve(null);
  }
}

async function testRPC() {
  console.log("\n[probe] Testing RPC methods...\n");

  const tests = [
    "agents.list",
    "sessions.list",
    "cron.list",
    "health",
    "channels.status",
    "models.list",
    "config.get",
    "skills.status",
    "exec.approvals.get",
    "logs.tail",
  ];

  for (const method of tests) {
    try {
      const result = await callRPC(method);
      if (result) {
        const preview = JSON.stringify(result).slice(0, 120);
        console.log(`  → ${preview}...`);
      }
    } catch (err) {
      console.error(`  → Error: ${err}`);
    }
    console.log();
  }

  console.log("\n[probe] Probing config schema...");
  try {
    const cfg = await callRPC("config.get") as { hash?: string; raw?: string };
    const hash = cfg.hash;
    console.log(`[probe] got config hash: ${hash}`);

    try {
      await callRPC("config.patch", { raw: cfg.raw, baseHash: hash });
      console.log("[probe] config.patch with { raw, baseHash } SUCCEEDED");
    } catch (e) {
      console.error("[probe] config.patch { raw, baseHash } failed:", e);
    }
  } catch (e) {
    console.error("[probe] failed to get base config:", e);
  }

  console.log("\n[probe] Testing non-existent methods (should fail)...");
  for (const method of ["chat.inject", "sessions.usage"]) {
    try {
      await callRPC(method);
    } catch {
      console.log(`  ${method}: Expected failure confirmed`);
    }
  }

  console.log("\n[probe] All tests complete. Closing connection.");
  ws.close();
  process.exit(0);
}

ws.on("close", (code, reason) => {
  console.log(`[probe] Connection closed: ${code} ${reason.toString()}`);
});

ws.on("error", (err) => {
  console.error(`[probe] Connection error:`, err.message);
  process.exit(1);
});
