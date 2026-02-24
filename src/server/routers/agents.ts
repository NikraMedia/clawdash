import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const agentsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.gateway.agentsList();
  }),

  skills: publicProcedure
    .input(
      z
        .object({
          agentId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.gateway.skillsStatus(input ?? undefined);
    }),

  files: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.gateway.hasMethod("agents.files")) {
        return { files: [] };
      }
      return ctx.gateway.agentFiles(input);
    }),
});
