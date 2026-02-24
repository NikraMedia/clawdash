import { GatewayClient } from "./client";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Resolve token robustly — handles quoted/unquoted values in .env.
 * Uses split(/=(.*)/) to avoid stripping `=` characters inside base64 tokens.
 */
function resolveToken(): string {
  if (process.env.OPENCLAW_GATEWAY_TOKEN) {
    return process.env.OPENCLAW_GATEWAY_TOKEN;
  }
  try {
    const envPath = join(process.env.HOME || "", ".openclaw", ".env");
    const envFile = readFileSync(envPath, "utf8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx);
      const rest = [trimmed.slice(eqIdx + 1)];
      if (key !== "GATEWAY_AUTH_TOKEN") continue;
      let value = rest[0] ?? "";
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value;
    }
  } catch (err) {
    console.warn("[claw-dash] Failed to read gateway token from ~/.openclaw/.env:", (err as Error).message);
  }
  console.warn("[claw-dash] No gateway token found — set OPENCLAW_GATEWAY_TOKEN or add GATEWAY_AUTH_TOKEN to ~/.openclaw/.env");
  return "";
}

// Survive Next.js Fast Refresh in dev — attach singleton to globalThis
const globalForGateway = globalThis as unknown as {
  __clawDashGateway?: GatewayClient;
};

export function getGateway(): GatewayClient {
  if (!globalForGateway.__clawDashGateway) {
    const url =
      process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
    const token = resolveToken();
    const client = new GatewayClient(url, token);
    client.connect();
    globalForGateway.__clawDashGateway = client;
  }
  return globalForGateway.__clawDashGateway;
}

export { GatewayClient } from "./client";
export * from "./types";
