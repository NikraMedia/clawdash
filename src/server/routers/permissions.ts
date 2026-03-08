import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const PERMISSIONS_FILE = "C:\\Users\\Nikra\\.openclaw\\shared\\permission-requests.json";

interface PermissionRequest {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  description: string;
  target?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
}

function readRequests(): PermissionRequest[] {
  try {
    if (!existsSync(PERMISSIONS_FILE)) {
      const dir = dirname(PERMISSIONS_FILE);
      mkdirSync(dir, { recursive: true });
      writeFileSync(PERMISSIONS_FILE, "[]", "utf8");
      return [];
    }
    return JSON.parse(readFileSync(PERMISSIONS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeRequests(requests: PermissionRequest[]) {
  const dir = dirname(PERMISSIONS_FILE);
  mkdirSync(dir, { recursive: true });
  writeFileSync(PERMISSIONS_FILE, JSON.stringify(requests, null, 2), "utf8");
}

export const permissionsRouter = router({
  getRequests: publicProcedure.query(() => {
    return { requests: readRequests() };
  }),

  approveRequest: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const requests = readRequests();
      const req = requests.find((r) => r.id === input.id);
      if (!req) throw new Error("Request not found");
      req.status = "approved";
      req.resolvedAt = new Date().toISOString();
      writeRequests(requests);
      return { ok: true };
    }),

  rejectRequest: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const requests = readRequests();
      const req = requests.find((r) => r.id === input.id);
      if (!req) throw new Error("Request not found");
      req.status = "rejected";
      req.resolvedAt = new Date().toISOString();
      writeRequests(requests);
      return { ok: true };
    }),

  clearResolved: publicProcedure.mutation(() => {
    const requests = readRequests().filter((r) => r.status === "pending");
    writeRequests(requests);
    return { ok: true };
  }),
});
