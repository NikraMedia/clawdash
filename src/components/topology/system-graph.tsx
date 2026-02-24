"use client";

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AgentNode, type AgentNodeType } from "./agent-node";
import { CronNode, type CronNodeType } from "./cron-node";
import { ChannelNode, type ChannelNodeType } from "./channel-node";

interface Agent {
  id: string;
  name?: string;
  emoji?: string;
  default?: boolean;
}

interface CronJob {
  id: string;
  name: string;
  agentId: string;
  enabled: boolean;
  state: {
    lastStatus?: "ok" | "error" | "timeout" | null;
  };
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

export function SystemGraph({
  agents,
  cronJobs,
  channels,
  sessionCounts,
}: SystemGraphProps) {
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    const n: AppNode[] = [];
    const e: Edge[] = [];

    // Place agents in a horizontal row at center
    const agentY = 200;
    const agentSpacing = 260; // Increased spacing for larger nodes
    const agentStartX = -(agents.length - 1) * (agentSpacing / 2);

    agents.forEach((agent, i) => {
      const agentNode: AgentNodeType = {
        id: `agent-${agent.id}`,
        type: "agent",
        position: { x: agentStartX + i * agentSpacing, y: agentY },
        data: {
          label: agent.name ?? agent.id,
          emoji: agent.emoji,
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
          position: { x: startX + j * cronSpacing, y: agentNode.position.y + 160 },
          data: {
            label: job.name,
            status: job.state.lastStatus ?? undefined,
            agentId: job.agentId,
          },
        };
        n.push(cronNode);

        let strokeColor = "#3f3f46"; // zinc-700
        if (job.state.lastStatus === "error") strokeColor = "#ef4444"; // red-500
        else if (job.state.lastStatus === "timeout") strokeColor = "#f59e0b"; // amber-500
        else if (job.enabled) strokeColor = "#10b981"; // emerald-500

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
            stroke: ch.connected ? "#10b981" : "#52525b", // emerald-500 or zinc-600
            strokeWidth: ch.connected ? 2 : 1.5,
            opacity: ch.connected ? 0.8 : 0.4,
          },
          animated: ch.connected,
        });
      }
    });

    return { nodes: n, edges: e };
  }, [agents, cronJobs, channels, sessionCounts]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "agent") {
        const { agentId } = node.data as AgentNodeType["data"];
        router.push(`/sessions?agent=${agentId}`);
      } else if (node.type === "cron") {
        const cronId = node.id.replace("cron-", "");
        router.push(`/cron?job=${cronId}`);
      }
    },
    [router]
  );

  const containerHeight = Math.max(300, Math.min(600, 200 + nodes.length * 40));

  return (
    <div
      className="w-full rounded-2xl border border-zinc-800/80 bg-zinc-950/60 ring-1 ring-inset ring-white/5 relative overflow-hidden shadow-inner backdrop-blur-md"
      style={{ height: containerHeight }}
    >
      {/* Premium glow underlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(24,24,27,0),rgba(9,9,11,0.8))] pointer-events-none z-10" />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
        className="z-0"
      >
        <Background color="#52525b" gap={24} size={1.5} className="opacity-30" />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "agent") return "#6366f1";
            if (node.type === "cron") return "#10b981";
            return "#3b82f6";
          }}
          maskColor="rgba(0,0,0,0.7)"
          style={{ background: "#18181b" }}
        />
        <Controls className="!bg-zinc-900 !border-zinc-700" />
      </ReactFlow>
    </div>
  );
}
