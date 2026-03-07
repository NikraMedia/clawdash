import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const OPENCLAW_JSON = "C:\\Users\\Nikra\\.openclaw\\openclaw.json";
const DEPARTMENTS_DIR = "C:\\Users\\Nikra\\.openclaw\\departments";
const SYSTEM_SKILLS_DIR = "C:\\Users\\Nikra\\AppData\\Roaming\\npm\\node_modules\\openclaw\\skills";
const CUSTOM_SKILLS_DIR = "C:\\Users\\Nikra\\.openclaw\\workspace\\skills";
const SKILLS_DIRS = [SYSTEM_SKILLS_DIR, CUSTOM_SKILLS_DIR];

function readConfig(): Record<string, unknown> {
  return JSON.parse(readFileSync(OPENCLAW_JSON, "utf8"));
}

function writeConfig(config: Record<string, unknown>): void {
  writeFileSync(OPENCLAW_JSON, JSON.stringify(config, null, 2), "utf8");
}

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

  setModel: publicProcedure
    .input(z.object({ agentId: z.string(), model: z.string() }))
    .mutation(({ input }) => {
      const config = readConfig();
      const agents = config.agents as Record<string, unknown> | undefined;
      if (!agents) throw new Error("No agents config found");

      const list = (agents.list ?? []) as Array<Record<string, unknown>>;
      const agent = list.find((a) => a.id === input.agentId);
      if (agent) {
        if (!agent.model || typeof agent.model !== "object") {
          agent.model = {};
        }
        (agent.model as Record<string, unknown>).primary = input.model;
      } else {
        // Also check if it's the main agent
        if (input.agentId === "manager" || input.agentId === "main") {
          const main = list.find((a) => a.id === "main");
          if (main) {
            if (!main.model || typeof main.model !== "object") {
              main.model = {};
            }
            (main.model as Record<string, unknown>).primary = input.model;
          }
        }
      }

      // Also update configs if present
      const configs = (agents as Record<string, unknown>).configs as Record<string, Record<string, unknown>> | undefined;
      if (configs) {
        if (!configs[input.agentId]) configs[input.agentId] = {};
        if (!configs[input.agentId].model || typeof configs[input.agentId].model !== "object") {
          configs[input.agentId].model = {};
        }
        ((configs[input.agentId].model) as Record<string, unknown>).primary = input.model;
      }

      writeConfig(config);
      return { ok: true };
    }),

  pingAgent: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.gateway.isConnected) {
        throw new Error("Gateway not connected");
      }
      const start = Date.now();
      const sessionKey = `agent:${input.agentId}:ping-${Date.now()}`;
      await ctx.gateway.chatSend({
        sessionKey,
        message: "Ping — antworte kurz mit OK",
        idempotencyKey: `ping-${input.agentId}-${Date.now()}`,
      });
      const responseTime = Date.now() - start;
      return { ok: true, responseTime };
    }),

  createAgent: publicProcedure
    .input(z.object({
      name: z.string(),
      emoji: z.string(),
      role: z.string(),
      model: z.string(),
    }))
    .mutation(({ input }) => {
      const agentId = input.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const deptDir = join(DEPARTMENTS_DIR, agentId);

      // Create department folder
      mkdirSync(join(deptDir, "memory"), { recursive: true });
      writeFileSync(join(deptDir, "SOUL.md"), `# SOUL.md - ${input.name}\n\n_${input.role}_\n\n## Rolle\n${input.role}\n`, "utf8");
      writeFileSync(join(deptDir, "AGENTS.md"), `# AGENTS.md\n\nWorkspace for ${input.name}.\n`, "utf8");
      writeFileSync(join(deptDir, "memory", "context.md"), `# ${input.name} Context\n\n## Erstellt: ${new Date().toISOString().slice(0, 10)}\n`, "utf8");

      // Add to openclaw.json
      const config = readConfig();
      const agents = config.agents as Record<string, unknown>;
      const list = (agents.list ?? []) as Array<Record<string, unknown>>;
      list.push({
        id: agentId,
        name: agentId,
        workspace: deptDir,
        agentDir: join("C:\\Users\\Nikra\\.openclaw\\agents", agentId, "agent"),
        model: { primary: input.model },
        identity: { name: input.name, emoji: input.emoji },
      });
      agents.list = list;
      writeConfig(config);

      return { ok: true, agentId };
    }),

  deleteAgent: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(({ input }) => {
      // Safety: don't delete manager or main
      if (["main", "manager"].includes(input.agentId)) {
        throw new Error("Cannot delete manager agent");
      }

      // Remove from openclaw.json
      const config = readConfig();
      const agents = config.agents as Record<string, unknown>;
      const list = (agents.list ?? []) as Array<Record<string, unknown>>;
      agents.list = list.filter((a) => a.id !== input.agentId);

      const configs = (agents as Record<string, unknown>).configs as Record<string, unknown> | undefined;
      if (configs && configs[input.agentId]) {
        delete configs[input.agentId];
      }
      writeConfig(config);

      // Delete department folder
      const deptNames = [input.agentId];
      // Map known agent IDs to department names
      const DEPT_MAP: Record<string, string> = {
        steve: "ceo", gary: "marketing", jimmy: "content", neil: "seo",
        nate: "analytics", alex: "sales", warren: "finance", tom: "tax",
        robert: "legal", tiago: "notion", pieter: "tech",
      };
      if (DEPT_MAP[input.agentId]) deptNames.push(DEPT_MAP[input.agentId]);

      for (const name of deptNames) {
        const deptDir = join(DEPARTMENTS_DIR, name);
        try {
          rmSync(deptDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }

      return { ok: true };
    }),

  listSkills: publicProcedure.query(() => {
    const skills: Array<{ name: string; path: string; source: string; description?: string }> = [];
    for (const dir of SKILLS_DIRS) {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillPath = join(dir, entry.name);
            let description: string | undefined;
            try {
              const skillMd = readFileSync(join(skillPath, "SKILL.md"), "utf8");
              const descMatch = skillMd.match(/^#[^\n]*\n+([^\n]+)/);
              if (descMatch) description = descMatch[1].slice(0, 100);
            } catch { /* no SKILL.md */ }
            skills.push({
              name: entry.name,
              path: skillPath,
              source: dir.includes("workspace") ? "workspace" : "global",
              description,
            });
          }
        }
      } catch { /* dir doesn't exist */ }
    }
    return { skills };
  }),

  getSkills: publicProcedure
    .input(z.object({ agentId: z.string() }))
    .query(({ input }) => {
      const config = readConfig();
      const agents = config.agents as Record<string, unknown> | undefined;
      const configs = (agents?.configs ?? {}) as Record<string, Record<string, unknown>>;
      const agentConfig = configs[input.agentId] ?? {};
      const disabledSkills = (agentConfig.disabledSkills ?? []) as string[];

      const skills: Array<{
        name: string;
        description: string;
        version: string;
        isSystem: boolean;
        isEnabled: boolean;
      }> = [];

      const readSkillsFromDir = (dir: string, isSystem: boolean) => {
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const skillPath = join(dir, entry.name);
            let description = "";
            let version = "—";
            let displayName = entry.name;

            // Try SKILL.md
            try {
              const skillMd = readFileSync(join(skillPath, "SKILL.md"), "utf8");
              const nameMatch = skillMd.match(/^#\s+(.+)/m);
              if (nameMatch) displayName = nameMatch[1].trim();
              const descMatch = skillMd.match(/^#[^\n]*\n+([^\n]+)/);
              if (descMatch) description = descMatch[1].slice(0, 120);
            } catch { /* no SKILL.md */ }

            // Try package.json for version
            try {
              const pkg = JSON.parse(readFileSync(join(skillPath, "package.json"), "utf8"));
              if (pkg.version) version = pkg.version;
              if (pkg.description && !description) description = pkg.description.slice(0, 120);
            } catch { /* no package.json */ }

            skills.push({
              name: entry.name,
              description: description || displayName,
              version,
              isSystem,
              isEnabled: !disabledSkills.includes(entry.name),
            });
          }
        } catch { /* dir doesn't exist */ }
      };

      readSkillsFromDir(SYSTEM_SKILLS_DIR, true);
      readSkillsFromDir(CUSTOM_SKILLS_DIR, false);

      return { skills, disabledSkills };
    }),

  toggleSkill: publicProcedure
    .input(z.object({ agentId: z.string(), skillName: z.string(), enabled: z.boolean() }))
    .mutation(({ input }) => {
      const config = readConfig();
      const agents = config.agents as Record<string, unknown>;
      if (!agents.configs) agents.configs = {};
      const configs = agents.configs as Record<string, Record<string, unknown>>;
      if (!configs[input.agentId]) configs[input.agentId] = {};
      const agentConfig = configs[input.agentId];
      let disabledSkills = (agentConfig.disabledSkills ?? []) as string[];

      if (input.enabled) {
        disabledSkills = disabledSkills.filter((s: string) => s !== input.skillName);
      } else {
        if (!disabledSkills.includes(input.skillName)) {
          disabledSkills.push(input.skillName);
        }
      }
      agentConfig.disabledSkills = disabledSkills;
      writeConfig(config);
      return { ok: true, disabledSkills };
    }),

  searchMarketplace: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const { execSync } = await import("child_process");
      try {
        const output = execSync(`clawhub search ${input.query}`, {
          encoding: "utf8",
          timeout: 30000,
        });
        // Parse clawhub search output — each result is typically: name - description
        const results: Array<{ name: string; description: string }> = [];
        for (const line of output.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("Searching") || trimmed.startsWith("Found") || trimmed.startsWith("No ")) continue;
          const match = trimmed.match(/^([^\s]+)\s*[-–—]\s*(.+)$/);
          if (match) {
            results.push({ name: match[1], description: match[2].trim() });
          } else if (trimmed.length > 0) {
            results.push({ name: trimmed.split(/\s/)[0], description: trimmed });
          }
        }
        return { results, raw: output };
      } catch (err) {
        return { results: [], raw: (err as Error).message };
      }
    }),

  installSkill: publicProcedure
    .input(z.object({ skillName: z.string() }))
    .mutation(async ({ input }) => {
      const { execSync } = await import("child_process");
      try {
        const output = execSync(`clawhub install ${input.skillName}`, {
          encoding: "utf8",
          timeout: 60000,
        });
        return { ok: true, output };
      } catch (err) {
        throw new Error(`Failed to install skill: ${(err as Error).message}`);
      }
    }),

  deleteSkill: publicProcedure
    .input(z.object({ skillName: z.string() }))
    .mutation(async ({ input }) => {
      // Only allow deleting custom skills
      const customPath = join(CUSTOM_SKILLS_DIR, input.skillName);
      if (!existsSync(customPath)) {
        throw new Error(`Skill "${input.skillName}" not found in custom skills`);
      }
      // Try clawhub uninstall first, fall back to direct delete
      const { execSync } = await import("child_process");
      try {
        execSync(`clawhub uninstall ${input.skillName}`, { encoding: "utf8", timeout: 30000 });
      } catch {
        // Fallback: direct delete
        rmSync(customPath, { recursive: true, force: true });
      }
      return { ok: true };
    }),
});
