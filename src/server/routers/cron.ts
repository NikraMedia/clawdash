import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const cronRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          includeDisabled: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.gateway.cronList(input ?? undefined);
    }),

  runs: publicProcedure
    .input(
      z.object({
        id: z.string(),
        limit: z.number().min(1).max(5000).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.gateway.cronRuns(input);
    }),

  run: publicProcedure
    .input(
      z.object({
        id: z.string(),
        mode: z.enum(["due", "force"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.gateway.isConnected) {
        throw new Error("Gateway not connected");
      }
      return ctx.gateway.cronRun(input);
    }),

  toggle: publicProcedure
    .input(
      z.object({
        id: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.gateway.isConnected) {
        throw new Error("Gateway not connected");
      }
      return ctx.gateway.cronUpdate({
        id: input.id,
        patch: { enabled: input.enabled },
      });
    }),
});
