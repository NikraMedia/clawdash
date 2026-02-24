import { initTRPC } from "@trpc/server";
import { getGateway } from "@/lib/gateway";

export const createTRPCContext = () => {
  return {
    gateway: getGateway(),
  };
};

const t = initTRPC.context<ReturnType<typeof createTRPCContext>>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
