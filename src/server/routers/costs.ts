import { z } from "zod";
import { router, publicProcedure } from "../trpc";

// Pricing constants (per million tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  default: { input: 3, output: 15 }, // claude-sonnet-4.6
};

function getPrice(model?: string) {
  return MODEL_PRICING[model ?? ""] ?? MODEL_PRICING.default;
}

export const costsRouter = router({
  summary: publicProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(1),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 1;
      const cutoff = Date.now() - days * 86400000;

      const raw = (await ctx.gateway.sessionsList({ limit: 10000 })) as {
        sessions?: Array<{
          key?: string;
          model?: string;
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
          updatedAt?: number | null;
          displayName?: string;
          label?: string;
          origin?: { from?: string };
        }>;
      };

      const sessions = (raw?.sessions ?? []).filter(
        (s) => (s.updatedAt ?? 0) >= cutoff
      );

      const safeNum = (v: unknown): number => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      // Extract agentId from session key (agent:AGENTID:...)
      function extractAgent(s: { key?: string; displayName?: string; label?: string; origin?: { from?: string } }): string {
        const key = s.key ?? "";
        const match = key.match(/^agent:([^:]+)/);
        if (match) return match[1];
        return s.displayName ?? s.origin?.from ?? "unknown";
      }

      const byAgent = new Map<string, {
        agentId: string;
        sessions: number;
        inputTokens: number;
        outputTokens: number;
        cost: number;
      }>();

      let totalInput = 0;
      let totalOutput = 0;
      let totalCost = 0;

      for (const s of sessions) {
        const agentId = extractAgent(s);
        const inp = safeNum(s.inputTokens);
        const out = safeNum(s.outputTokens);
        const price = getPrice(s.model);
        const cost = (inp / 1_000_000) * price.input + (out / 1_000_000) * price.output;

        totalInput += inp;
        totalOutput += out;
        totalCost += cost;

        const entry = byAgent.get(agentId) ?? { agentId, sessions: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
        entry.sessions += 1;
        entry.inputTokens += inp;
        entry.outputTokens += out;
        entry.cost += cost;
        byAgent.set(agentId, entry);
      }

      const agents = Array.from(byAgent.values()).sort((a, b) => b.cost - a.cost);
      const mostActive = agents[0]?.agentId ?? "—";
      const avgPerSession = sessions.length > 0 ? totalCost / sessions.length : 0;

      return {
        totalInput,
        totalOutput,
        totalCost,
        totalSessions: sessions.length,
        mostActive,
        avgPerSession,
        agents,
      };
    }),
});
