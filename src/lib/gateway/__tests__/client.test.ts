import { GatewayClient } from "../client";
import { readFileSync } from "fs";
import { join } from "path";

function resolveToken(): string {
  if (process.env.OPENCLAW_GATEWAY_TOKEN)
    return process.env.OPENCLAW_GATEWAY_TOKEN;
  try {
    const envFile = readFileSync(
      join(process.env.HOME || "", ".openclaw", ".env"),
      "utf8"
    );
    for (const line of envFile.split("\n")) {
      if (line.trim().startsWith("GATEWAY_AUTH_TOKEN=")) {
        let v = line.trim().slice("GATEWAY_AUTH_TOKEN=".length);
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        )
          v = v.slice(1, -1);
        return v;
      }
    }
  } catch {}
  return "";
}

// Integration test — requires running OpenClaw gateway
describe("GatewayClient", () => {
  const url = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
  const token = resolveToken();

  it("connects to gateway and receives hello payload", async () => {
    const client = new GatewayClient(url, token);
    const hello = await new Promise<Record<string, unknown>>((resolve, reject) => {
      client.on("connected", resolve);
      client.on("error", reject);
      client.connect();
      setTimeout(() => reject(new Error("timeout")), 5000);
    });

    expect(hello.protocol).toBe(3);
    expect(hello.snapshot).toBeDefined();
    expect(hello.snapshot.presence).toBeDefined();
    expect(hello.server.version).toBeDefined();
    expect(hello.features.methods.length).toBeGreaterThan(80);
    client.disconnect();
  });

  it("lists agents via RPC", async () => {
    const client = new GatewayClient(url, token);
    await new Promise<void>((resolve, reject) => {
      client.on("connected", () => resolve());
      client.on("error", reject);
      client.connect();
      setTimeout(() => reject(new Error("timeout")), 5000);
    });

    const result = await client.agentsList();
    expect(result.agents).toBeInstanceOf(Array);
    expect(result.agents.length).toBeGreaterThan(0);
    client.disconnect();
  });

  it("exposes available methods for capability checking", async () => {
    const client = new GatewayClient(url, token);
    await new Promise<void>((resolve, reject) => {
      client.on("connected", () => resolve());
      client.on("error", reject);
      client.connect();
      setTimeout(() => reject(new Error("timeout")), 5000);
    });

    // Verified to exist
    expect(client.hasMethod("agents.list")).toBe(true);
    expect(client.hasMethod("sessions.list")).toBe(true);
    expect(client.hasMethod("chat.send")).toBe(true);

    // Verified to NOT exist
    expect(client.hasMethod("chat.inject")).toBe(false);

    client.disconnect();
  });
});
