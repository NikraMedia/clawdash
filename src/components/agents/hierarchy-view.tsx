"use client";

import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { HierarchyNode, type HierarchyNodeType } from "./hierarchy-node";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AgentData {
  id: string;
  name?: string;
  emoji?: string;
  model?: string;
}

const AGENT_META: Record<string, { role: string; color: string; emoji: string }> = {
  manager: { role: "COO", color: "indigo", emoji: "\uD83D\uDCCB" },
  steve: { role: "CEO", color: "amber", emoji: "\uD83D\uDC54" },
  gary: { role: "Marketing", color: "pink", emoji: "\uD83D\uDCE3" },
  jimmy: { role: "Content", color: "orange", emoji: "\u270D\uFE0F" },
  neil: { role: "SEO", color: "green", emoji: "\uD83D\uDD0D" },
  nate: { role: "Analytics", color: "cyan", emoji: "\uD83D\uDCCA" },
  alex: { role: "Sales", color: "red", emoji: "\uD83E\uDD1D" },
  warren: { role: "Finance", color: "emerald", emoji: "\uD83D\uDCB0" },
  tom: { role: "Tax", color: "yellow", emoji: "\uD83E\uDDFE" },
  robert: { role: "Legal", color: "purple", emoji: "\u2696\uFE0F" },
  tiago: { role: "Notion", color: "blue", emoji: "\uD83D\uDCD3" },
  pieter: { role: "Tech", color: "zinc", emoji: "\uD83D\uDEE0\uFE0F" },
};

const nodeTypes: NodeTypes = {
  hierarchy: HierarchyNode,
};

interface HierarchyViewProps {
  agents: AgentData[];
  sessionCounts: Record<string, number>;
  onNodeClick: (agentId: string | null) => void;
  selectedAgentId: string | null;
}

// Hardcoded agent definitions — always visible regardless of tRPC data
const HARDCODED_AGENTS = [
  { id: "steve", name: "Steve", emoji: "\uD83E\uDDE0", role: "Strategie", color: "amber" },
  { id: "gary", name: "Gary", emoji: "\uD83D\uDCE3", role: "Marketing", color: "pink" },
  { id: "jimmy", name: "Jimmy", emoji: "\u270D\uFE0F", role: "Content", color: "orange" },
  { id: "neil", name: "Neil", emoji: "\uD83D\uDD0D", role: "SEO", color: "green" },
  { id: "nate", name: "Nate", emoji: "\uD83D\uDCCA", role: "Analytics", color: "cyan" },
  { id: "alex", name: "Alex", emoji: "\uD83D\uDCBC", role: "Sales", color: "red" },
  { id: "warren", name: "Warren", emoji: "\uD83D\uDCB0", role: "Finance", color: "emerald" },
  { id: "tom", name: "Tom", emoji: "\uD83D\uDCCB", role: "Tax", color: "yellow" },
  { id: "robert", name: "Robert", emoji: "\u2696\uFE0F", role: "Legal", color: "purple" },
  { id: "tiago", name: "Tiago", emoji: "\uD83D\uDDC3\uFE0F", role: "Notion", color: "blue" },
  { id: "pieter", name: "Pieter", emoji: "\uD83D\uDCBB", role: "Tech", color: "zinc" },
] as const;

function buildLayout(agents: AgentData[], sessionCounts: Record<string, number>) {
  const nodes: HierarchyNodeType[] = [];
  const edges: Edge[] = [];

  // Build lookup from tRPC data for optional enrichment (model, etc.)
  const agentLookup = new Map(agents.map((a) => [a.id, a]));

  // Layout constants
  const nodeWidth = 170;
  const nodeSpacing = 200;
  const totalWidth = (HARDCODED_AGENTS.length - 1) * nodeSpacing;
  const startX = -totalWidth / 2;
  const chefY = 0;
  const managerY = 180;
  const agentY = 380;

  // Chef node
  nodes.push({
    id: "chef",
    type: "hierarchy",
    position: { x: 0 - nodeWidth / 2 + 40, y: chefY },
    data: {
      label: "Niko",
      emoji: "\uD83D\uDC51",
      role: "CEO / Chef",
      isActive: true,
      isChef: true,
      color: "gold",
    },
  } as HierarchyNodeType);

  // Manager node
  const managerAgent = agentLookup.get("manager");
  nodes.push({
    id: "agent-manager",
    type: "hierarchy",
    position: { x: 0 - nodeWidth / 2 + 40, y: managerY },
    data: {
      label: managerAgent?.name ?? "Manager",
      emoji: managerAgent?.emoji ?? AGENT_META.manager.emoji,
      role: AGENT_META.manager.role,
      model: managerAgent?.model,
      isActive: (sessionCounts["manager"] ?? 0) > 0,
      color: AGENT_META.manager.color,
      agentId: "manager",
    },
  } as HierarchyNodeType);

  // Edge: Chef -> Manager
  edges.push({
    id: "edge-chef-manager",
    source: "chef",
    target: "agent-manager",
    style: { stroke: "#fbbf24", strokeWidth: 2, opacity: 0.6 },
    animated: true,
  });

  // Hardcoded sub-agent nodes
  HARDCODED_AGENTS.forEach((def, i) => {
    const nodeId = `agent-${def.id}`;
    const live = agentLookup.get(def.id);

    nodes.push({
      id: nodeId,
      type: "hierarchy",
      position: { x: startX + i * nodeSpacing, y: agentY },
      data: {
        label: live?.name ?? def.name,
        emoji: live?.emoji ?? def.emoji,
        role: def.role,
        model: live?.model,
        isActive: (sessionCounts[def.id] ?? 0) > 0,
        color: def.color,
        agentId: def.id,
      },
    } as HierarchyNodeType);

    // Edge: Manager -> Agent
    edges.push({
      id: `edge-manager-${def.id}`,
      source: "agent-manager",
      target: nodeId,
      style: { stroke: "#6366f1", strokeWidth: 1.5, opacity: 0.4 },
      animated: true,
    });
  });

  return { nodes, edges };
}

export function HierarchyView({ agents, sessionCounts, onNodeClick, selectedAgentId }: HierarchyViewProps) {
  const initialLayout = useMemo(() => buildLayout(agents, sessionCounts), [agents, sessionCounts]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayout.edges);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  const resetLayout = useCallback(() => {
    const layout = buildLayout(agents, sessionCounts);
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [agents, sessionCounts, setNodes, setEdges]);

  // Apply highlighting
  const displayNodes = useMemo(() => {
    if (!highlightedNodeId) return nodes;
    const connectedIds = new Set<string>([highlightedNodeId]);
    edges.forEach((e) => {
      if (e.source === highlightedNodeId || e.target === highlightedNodeId) {
        connectedIds.add(e.source);
        connectedIds.add(e.target);
      }
    });
    return nodes.map((n) => ({
      ...n,
      data: { ...n.data, dimmed: !connectedIds.has(n.id) },
    }));
  }, [nodes, edges, highlightedNodeId]);

  const displayEdges = useMemo(() => {
    if (!highlightedNodeId) return edges;
    return edges.map((e) => {
      const related = e.source === highlightedNodeId || e.target === highlightedNodeId;
      return {
        ...e,
        style: {
          ...e.style,
          opacity: related ? 1 : 0.08,
          strokeWidth: related ? 2.5 : (e.style?.strokeWidth as number),
        },
      };
    });
  }, [edges, highlightedNodeId]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id === "chef") return;
    const agentId = (node.data as { agentId?: string }).agentId ?? null;
    onNodeClick(agentId);
  }, [onNodeClick]);

  return (
    <div className="relative w-full h-full">
      {/* Reset button */}
      <div className="absolute top-3 right-3 z-20">
        <Button
          onClick={resetLayout}
          variant="ghost"
          size="sm"
          className="h-8 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-950/70 backdrop-blur-sm border border-zinc-800/60 hover:bg-zinc-900/80"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset Layout
        </Button>
      </div>

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={(_, node) => setHighlightedNodeId(node.id)}
        onNodeMouseLeave={() => setHighlightedNodeId(null)}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={1.5}
        className="z-0"
      >
        <Background color="#52525b" gap={24} size={1.5} className="opacity-30" />
      </ReactFlow>
    </div>
  );
}
