import { router } from "../trpc";
import { systemRouter } from "./system";
import { agentsRouter } from "./agents";
import { sessionsRouter } from "./sessions";
import { cronRouter } from "./cron";

export const appRouter = router({
  system: systemRouter,
  agents: agentsRouter,
  sessions: sessionsRouter,
  cron: cronRouter,
});

export type AppRouter = typeof appRouter;
