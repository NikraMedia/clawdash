import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getCollector } from "@/lib/collector";

export const systemRouter = router({
  health: publicProcedure.query(({ ctx }) => {
    const { gateway } = ctx;
    return {
      connected: gateway.isConnected,
      snapshot: gateway.currentSnapshot,
      server: gateway.server,
      methods: gateway.methods,
      events: gateway.events,
    };
  }),

  status: publicProcedure.query(async ({ ctx }) => {
    return ctx.gateway.systemStatus();
  }),

  models: publicProcedure.query(async ({ ctx }) => {
    return ctx.gateway.modelsList();
  }),

  channels: publicProcedure
    .input(
      z
        .object({
          probe: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.gateway.channelsStatus(input ?? undefined);
    }),

  config: publicProcedure.query(async ({ ctx }) => {
    return ctx.gateway.configGet();
  }),

  configUpdate: publicProcedure
    .input(z.object({ raw: z.string(), baseHash: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.gateway.isConnected) {
        throw new Error("Gateway not connected");
      }
      await ctx.gateway.configUpdate(input);
      return { success: true };
    }),

  execApprovals: publicProcedure.query(async ({ ctx }) => {
    return ctx.gateway.execApprovalsGet();
  }),

  execApprovalsResolve: publicProcedure
    .input(
      z
        .object({
          id: z.string().optional(),
          sessionKey: z.string().optional(),
          resolution: z.enum(["approved", "rejected"]),
        })
        .refine((input) => Boolean(input.id || input.sessionKey), {
          message: "Either id or sessionKey is required",
        })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.gateway.isConnected) {
        throw new Error("Gateway not connected");
      }

      return ctx.gateway.execApprovalsResolve({
        id: input.id,
        sessionKey: input.sessionKey,
        resolution: input.resolution,
      });
    }),

  logs: publicProcedure
    .input(
      z
        .object({
          cursor: z.number().optional(),
          limit: z.number().min(1).max(5000).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.gateway.logsTail(input ?? undefined);
    }),

  activity: publicProcedure
    .input(
      z
        .object({
          showAll: z.boolean().optional(),
          agentId: z.string().optional(),
          eventType: z.string().optional(),
          severity: z.string().optional(),
          limit: z.number().min(1).max(1000).optional(),
        })
        .optional()
    )
    .query(({ input }) => {
      const collector = getCollector();
      const events = collector.getEvents(input ?? undefined);
      return {
        events,
        meta: {
          totalBuffered: collector.size,
          eventTypes: collector.eventTypes,
          agentIds: collector.agentIds,
        },
      };
    }),
});
