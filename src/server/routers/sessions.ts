import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const sessionsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          limit: z.number().optional(),
          activeMinutes: z.number().optional(),
          includeGlobal: z.boolean().optional(),
          includeDerivedTitles: z.boolean().optional(),
          includeLastMessage: z.boolean().optional(),
          agentId: z.string().optional(),
          search: z.string().optional(),
          spawnedBy: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.gateway.sessionsList(input ?? undefined);
    }),

  preview: publicProcedure
    .input(
      z.object({
        keys: z.array(z.string()).min(1),
        limit: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.gateway.sessionsPreview(input);
    }),

  history: publicProcedure
    .input(
      z.object({
        sessionKey: z.string(),
        limit: z.number().min(1).max(1000).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.gateway.chatHistory(input);
    }),

  // Token usage computed server-side from sessions.list (sessions.usage does NOT exist as gateway method)
  usage: publicProcedure
    .input(
      z
        .object({
          agentId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const sessions = (await ctx.gateway.sessionsList({
        agentId: input?.agentId,
        limit: 10000,
      })) as {
        sessions?: Array<{
          model?: string;
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
        }>;
      };

      const safeNum = (v: unknown): number => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      const sessionList = sessions?.sessions ?? [];
      let totalInput = 0;
      let totalOutput = 0;
      let totalTokens = 0;
      const byModelMap = new Map<
        string,
        { input: number; output: number; count: number }
      >();

      for (const s of sessionList) {
        totalInput += safeNum(s.inputTokens);
        totalOutput += safeNum(s.outputTokens);
        totalTokens += safeNum(s.totalTokens);
        const model = s.model ?? "unknown";
        const entry = byModelMap.get(model) ?? {
          input: 0,
          output: 0,
          count: 0,
        };
        entry.input += safeNum(s.inputTokens);
        entry.output += safeNum(s.outputTokens);
        entry.count += 1;
        byModelMap.set(model, entry);
      }

      return {
        totalInput,
        totalOutput,
        totalTokens,
        sessionCount: sessionList.length,
        byModel: Array.from(byModelMap.entries()).map(([model, v]) => ({
          model,
          ...v,
        })),
      };
    }),

  // --- Mutations ---
  send: publicProcedure
    .input(
      z.object({
        sessionKey: z.string(),
        message: z.string(),
        idempotencyKey: z.string(),
        model: z.string().optional(),
        thinkingLevel: z.string().optional(),
        workflow: z.string().optional(),
        skills: z.array(z.string()).optional(),
        attachments: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            size: z.number(),
            base64: z.string().optional(),
          })
        ).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.gateway.isConnected) {
        throw new Error("Gateway not connected");
      }
      return ctx.gateway.chatSend(input);
    }),

  abort: publicProcedure
    .input(
      z.object({
        sessionKey: z.string(),
        runId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.gateway.isConnected) {
        throw new Error("Gateway not connected");
      }
      return ctx.gateway.chatAbort(input);
    }),

  resolveApproval: publicProcedure
    .input(
      z.object({
        sessionKey: z.string(),
        resolution: z.enum(["approved", "rejected"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.gateway.isConnected) {
        throw new Error("Gateway not connected");
      }
      return ctx.gateway.execApprovalsResolve({
        sessionKey: input.sessionKey,
        resolution: input.resolution,
      });
    }),

  patch: publicProcedure
    .input(
      z.object({
        key: z.string(),
        label: z.string().optional(),
        thinkingLevel: z.string().optional(),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.gateway.isConnected) {
        throw new Error("Gateway not connected");
      }
      return ctx.gateway.sessionsPatch(input);
    }),
});
