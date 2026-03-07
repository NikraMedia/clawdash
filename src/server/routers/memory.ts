import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { readFileSync, statSync } from "fs";
import { join } from "path";

const DEPARTMENTS_DIR = "C:\\Users\\Nikra\\.openclaw\\departments";

// Map agent IDs to department folder names
const AGENT_DEPT_MAP: Record<string, string> = {
  steve: "ceo",
  gary: "marketing",
  jimmy: "content",
  neil: "seo",
  nate: "analytics",
  alex: "sales",
  warren: "finance",
  tom: "tax",
  robert: "legal",
  tiago: "notion",
  pieter: "tech",
  manager: "main",
};

export const memoryRouter = router({
  getAgentMemory: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(({ input }) => {
      const dept = AGENT_DEPT_MAP[input.agentId] ?? input.agentId;
      const memoryPath = join(DEPARTMENTS_DIR, dept, "memory", "context.md");
      try {
        const content = readFileSync(memoryPath, "utf8");
        const stat = statSync(memoryPath);
        return {
          content,
          lastModified: stat.mtimeMs,
          exists: true,
        };
      } catch {
        return {
          content: null,
          lastModified: null,
          exists: false,
        };
      }
    }),

  syncAgent: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.gateway.isConnected) {
        throw new Error("Gateway not connected");
      }
      const sessionKey = `agent:${input.agentId}:main`;
      return ctx.gateway.chatSend({
        sessionKey,
        message: "Update your memory context.md with current status. Summarize what you know and what's been happening.",
        idempotencyKey: `sync-${input.agentId}-${Date.now()}`,
      });
    }),
});
