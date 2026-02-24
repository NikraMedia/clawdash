"use client";

import { useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AgentNode, type AgentNodeType } from "./agent-node";
import { CronNode, type CronNodeType } from "./cron-node";
import { ChannelNode, type ChannelNodeType } from "./channel-node";
import { Bot, Clock, Activity } from "lucide-react";

interface Agent {
  id: string;
  name?: string;
  emoji?: string;
  model?: string | { primary?: string };
  default?: boolean;
}

interface CronJob {
  id: string;
  name: string;
  schedule?: { kind?: string; expr?: string; everyMs?: number; at?: string };
  agentId: string;
  enabled: boolean;
  state: {
    lastStatus?: "ok" | "error" | "timeout" | null;
  };
}

function resolveModel(model?: string | { primary?: string }): string | undefined {
  if (!model) return undefined;
  if (typeof model === "string") return model;
  return model.primary;
}

function formatSchedule(s?: CronJob["schedule"]): string | undefined {
  if (!s) return undefined;
  if (s.expr) return s.expr;
  if (s.at) return `at ${s.at}`;
  if (s.everyMs) {
    const mins = Math.round(s.everyMs / 60_000);
    return mins >= 60 ? `every ${Math.round(mins / 60)}h` : `every ${mins}m`;
  }
  return s.kind;
}

interface Channel {
  name: string;
  connected?: boolean;
  agentId?: string;
}

interface SystemGraphProps {
  agents: Agent[];
  cronJobs: CronJob[];
  channels: Channel[];
  sessionCounts: Record<string, number>;
}

type AppNode = AgentNodeType | CronNodeType | ChannelNodeType;

const nodeTypes: NodeTypes = {
  agent: AgentNode,
  cron: CronNode,
  channel: ChannelNode,
};

/* ─── Legend ───────────────────────────────────────────────── */
function GraphLegend() {
  return (
    <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5 rounded-xl border border-zinc-800/60 bg-zinc-950/80 px-3 py-2 backdrop-blur-xl shadow-lg text-[10px] text-zinc-400 ring-1 ring-inset ring-white/5">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
        Legend
      </span>
      <div className="flex items-center gap-2">
        <Bot className="h-3 w-3 text-indigo-400" />
        <span>Agent</span>
      </div>
      <div className="flex items-center gap-2">
        <Activity className="h-3 w-3 text-blue-400" />
        <span>Channel</span>
      </div>
      <div className="flex items-center gap-2">
        <Clock className="h-3 w-3 text-zinc-500" />
        <span>Cron Job</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 border-t border-zinc-800/60 pt-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
        <span>Healthy</span>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 ml-1" />
        <span>Error</span>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 ml-1" />
        <span>Warning</span>
      </div>
    </div>
  );
}

export function SystemGraph({
  agents,
  cronJobs,
  channels,
  sessionCounts,
}: SystemGraphProps) {
  const router = useRouter();
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(
    null
  );

  // Build an agent-name lookup for channel tooltips
  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((a) => map.set(a.id, a.name ?? a.id));
    return map;
  }, [agents]);

  // ─── Base layout (stable positions, no dependency on hover state) ─────
  const { baseNodes, baseEdges } = useMemo(() => {
    const n: AppNode[] = [];
    const e: Edge[] = [];

    // Place agents in a horizontal row at center
    const agentY = 200;
    const agentSpacing = 260;
    const agentStartX = -(agents.length - 1) * (agentSpacing / 2);

    agents.forEach((agent, i) => {
      const agentNode: AgentNodeType = {
        id: `agent-${agent.id}`,
        type: "agent",
        position: { x: agentStartX + i * agentSpacing, y: agentY },
        data: {
          label: agent.name ?? agent.id,
          emoji: agent.emoji,
          model: resolveModel(agent.model),
          sessionCount: sessionCounts[agent.id] ?? 0,
          isDefault: agent.default,
          agentId: agent.id,
        },
      };
      n.push(agentNode);
    });

    // Place cron jobs below their parent agents
    const cronByAgent = new Map<string, CronJob[]>();
    cronJobs.forEach((job) => {
      const list = cronByAgent.get(job.agentId) ?? [];
      list.push(job);
      cronByAgent.set(job.agentId, list);
    });

    cronByAgent.forEach((jobs, agentId) => {
      const agentNode = n.find((nd) => nd.id === `agent-${agentId}`);
      if (!agentNode) return;

      const cronSpacing = 160;
      const startX =
        agentNode.position.x - ((jobs.length - 1) * cronSpacing) / 2;

      jobs.forEach((job, j) => {
        const nodeId = `cron-${job.id}`;
        const cronNode: CronNodeType = {
          id: nodeId,
          type: "cron",
          position: {
            x: startX + j * cronSpacing,
            y: agentNode.position.y + 160,
          },
          data: {
            label: job.name,
            status: job.state.lastStatus ?? undefined,
            enabled: job.enabled,
            schedule: formatSchedule(job.schedule),
            agentId: job.agentId,
          },
        };
        n.push(cronNode);

        let strokeColor = "#3f3f46"; // zinc-700
        if (job.state.lastStatus === "error") strokeColor = "#ef4444";
        else if (job.state.lastStatus === "timeout") strokeColor = "#f59e0b";
        else if (job.enabled) strokeColor = "#10b981";

        e.push({
          id: `edge-${agentId}-${job.id}`,
          source: `agent-${agentId}`,
          target: nodeId,
          style: {
            stroke: strokeColor,
            strokeWidth: job.enabled ? 2 : 1.5,
            opacity: job.enabled ? 0.8 : 0.4,
          },
          animated: job.enabled,
        });
      });
    });

    // Place channels above agents
    channels.forEach((ch, i) => {
      const channelSpacing = 200;
      const startX = -(channels.length - 1) * (channelSpacing / 2);
      const nodeId = `channel-${ch.name}`;

      const channelNode: ChannelNodeType = {
        id: nodeId,
        type: "channel",
        position: { x: startX + i * channelSpacing, y: 40 },
        data: {
          label: ch.name,
          connected: ch.connected,
          agentName: ch.agentId ? agentNameMap.get(ch.agentId) : undefined,
        },
      };
      n.push(channelNode);

      // Connect to agent if bound
      if (ch.agentId) {
        e.push({
          id: `edge-ch-${ch.name}-${ch.agentId}`,
          source: nodeId,
          target: `agent-${ch.agentId}`,
          style: {
            stroke: ch.connected ? "#10b981" : "#52525b",
            strokeWidth: ch.connected ? 2 : 1.5,
            opacity: ch.connected ? 0.8 : 0.4,
          },
          animated: ch.connected,
        });
      }
    });

    return { baseNodes: n, baseEdges: e };
  }, [agents, cronJobs, channels, sessionCounts, agentNameMap]);

  // ─── Decorated nodes/edges (apply hover highlighting) ─────────────
  const { nodes, edges } = useMemo(() => {
    if (!highlightedNodeId) {
      return { nodes: baseNodes, edges: baseEdges };
    }

    // Determine which nodes are "connected" to the hovered node
    const connectedNodeIds = new Set<string>([highlightedNodeId]);
    const connectedEdgeIds = new Set<string>();

    baseEdges.forEach((edge) => {
      if (
        edge.source === highlightedNodeId ||
        edge.target === highlightedNodeId
      ) {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
        connectedEdgeIds.add(edge.id);
      }
    });

    const decoratedNodes = baseNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        dimmed: !connectedNodeIds.has(node.id),
      },
    }));

    const decoratedEdges = baseEdges.map((edge) => {
      const isRelated = connectedEdgeIds.has(edge.id);
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: isRelated ? 1 : 0.1,
          strokeWidth: isRelated
            ? ((edge.style?.strokeWidth as number) ?? 2) + 0.5
            : edge.style?.strokeWidth,
        },
      };
    });

    return { nodes: decoratedNodes, edges: decoratedEdges };
  }, [baseNodes, baseEdges, highlightedNodeId]);

  // ─── Event handlers ───────────────────────────────────────────────
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "agent") {
        const { agentId } = node.data as AgentNodeType["data"];
        router.push(`/sessions?agent=${agentId}`);
      } else if (node.type === "cron") {
        const cronId = node.id.replace("cron-", "");
        router.push(`/cron?job=${cronId}`);
      } else if (node.type === "channel") {
        router.push("/system?tab=channels");
      }
    },
    [router]
  );

  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setHighlightedNodeId(node.id);
    },
    []
  );

  const onNodeMouseLeave = useCallback(() => {
    setHighlightedNodeId(null);
  }, []);

  const containerHeight = Math.max(300, Math.min(600, 200 + nodes.length * 40));

  return (
    <div
      className="w-full rounded-2xl border border-zinc-800/80 bg-zinc-950/60 ring-1 ring-inset ring-white/5 relative overflow-hidden shadow-inner backdrop-blur-md"
      style={{ height: containerHeight }}
    >
      {/* Premium glow underlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(24,24,27,0),rgba(9,9,11,0.8))] pointer-events-none z-10" />

      {/* Legend */}
      <GraphLegend />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        nodesFocusable
        edgesFocusable
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
        className="z-0"
      >
        <Background color="#52525b" gap={24} size={1.5} className="opacity-30" />
      </ReactFlow>
    </div>
  );
}
