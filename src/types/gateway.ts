// Re-export canonical types from gateway client (single source of truth)
export type {
  SessionRow,
  SessionOrigin,
  CronSchedule,
  CronJobState,
  CronJob,
} from "@/lib/gateway/types";

// --- Message content normalization ---
export interface ContentBlock {
  type: string;
  text?: string;
}

export type MessageContent = string | ContentBlock[] | Record<string, unknown>;

export interface ChatMessage {
  role: string;
  content?: MessageContent;
  text?: string;
  ts?: number;
}

// --- Agent ---
export interface Agent {
  id: string;
  name?: string;
  emoji?: string;
  model?: string;
  workspace?: string;
}

// --- Channel ---
export interface Channel {
  name: string;
  connected: boolean;
  agentId?: string;
}
