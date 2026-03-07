"use client";

import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection,
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

export interface SessionActivity {
  agentId: string;
  lastActiveMs: number;
}

interface HierarchyViewProps {
  agents: AgentData[];
  sessionCounts: Record<string, number>;
  sessionActivity: Record<string, number>;
  cronCounts: Record<string, number>;
  onNodeClick: (agentId: string | null) => void;
  onModelChange: (agentId: string, model: string) => void;
  onMemoryClick: (agentId: string) => void;
  onPingClick: (agentId: string) => void;
  onSkillsClick: (agentId: string) => void;
  onCronClick: (agentId: string) => void;
  onDeleteClick: (agentId: string) => void;
  selectedAgentId: string | null;
}

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
  { id: "tiago", name: "Tiago", emoji: "\uD83D\uDDD3\uFE0F", role: "Notion", color: "blue" },
  { id: "pieter", name: "Pieter", emoji: "\uD83D\uDCBB", role: "Tech", color: "zinc" },
] as const;

// Node sizes per spec
const SUB_AGENT_SIZE = { width: 220, height: 200 };
const MANAGER_SIZE = { width: 240, height: 180 };
const CHEF_SIZE = { width: 220, height: 160 };

function getOnlineStatus(lastActiveMs: number | undefined): "online" | "idle" | "inactive" {
  if (!lastActiveMs) return "inactive";
  const ago = Date.now() - lastActiveMs;
  if (ago < 10 * 60 * 1000) return "online";
  if (ago < 60 * 60 * 1000) return "idle";
  return "inactive";
}

function formatLastActive(lastActiveMs: number | undefined): string | undefined {
  if (!lastActiveMs) return undefined;
  const ago = Date.now() - lastActiveMs;
  if (ago < 60_000) return "just now";
  if (ago < 3600_000) return `${Math.floor(ago / 60_000)}m ago`;
  if (ago < 86400_000) return `${Math.floor(ago / 3600_000)}h ago`;
  return `${Math.floor(ago / 86400_000)}d ago`;
}

const DEFAULT_EDGE_STYLE = {
  stroke: "#4f46e5",
  strokeWidth: 2,
};

function buildLayout(
  agents: AgentData[],
  sessionActivity: Record<string, number>,
  cronCounts: Record<string, number>,
  callbacks: {
    onNodeClick: (agentId: string | null) => void;
    onModelChange: (agentId: string, model: string) => void;
    onMemoryClick: (agentId: string) => void;
    onPingClick: (agentId: string) => void;
    onSkillsClick: (agentId: string) => void;
    onCronClick: (agentId: string) => void;
    onDeleteClick: (agentId: string) => void;
  }
) {
  const nodes: HierarchyNodeType[] = [];
  const edges: Edge[] = [];
  const agentLookup = new Map(agents.map((a) => [a.id, a]));

  const nodeSpacing = 240;
  const totalWidth = (HARDCODED_AGENTS.length - 1) * nodeSpacing;
  const startX = -totalWidth / 2;
  const chefY = 0;
  const managerY = 220;
  const agentY = 460;

  // Chef node
  nodes.push({
    id: "chef",
    type: "hierarchy",
    position: { x: -CHEF_SIZE.width / 2, y: chefY },
    style: { width: CHEF_SIZE.width, height: CHEF_SIZE.height },
    data: {
      label: "Niko",
      emoji: "\uD83D\uDC51",
      role: "CEO / Chef",
      isActive: true,
      isChef: true,
      color: "gold",
      onlineStatus: "online" as const,
    },
  } as HierarchyNodeType);

  // Manager node
  const managerAgent = agentLookup.get("manager");
  const managerModel = typeof managerAgent?.model === "string"
    ? managerAgent.model
    : (managerAgent?.model as Record<string, string> | undefined)?.primary;
  nodes.push({
    id: "agent-manager",
    type: "hierarchy",
    position: { x: -MANAGER_SIZE.width / 2, y: managerY },
    style: { width: MANAGER_SIZE.width, height: MANAGER_SIZE.height },
    data: {
      label: managerAgent?.name ?? "Manager",
      emoji: managerAgent?.emoji ?? AGENT_META.manager.emoji,
      role: AGENT_META.manager.role,
      model: managerModel,
      isActive: getOnlineStatus(sessionActivity["manager"]) === "online",
      isManager: true,
      color: AGENT_META.manager.color,
      agentId: "manager",
      onlineStatus: getOnlineStatus(sessionActivity["manager"]),
      lastActive: formatLastActive(sessionActivity["manager"]),
      cronCount: cronCounts["manager"] ?? 0,
      onModelChange: (m: string) => callbacks.onModelChange("main", m),
      onChatClick: () => callbacks.onNodeClick("manager"),
      onMemoryClick: () => callbacks.onMemoryClick("manager"),
      onPingClick: () => callbacks.onPingClick("manager"),
      onSkillsClick: () => callbacks.onSkillsClick("manager"),
      onCronClick: () => callbacks.onCronClick("manager"),
      onDeleteClick: () => {},
    },
  } as HierarchyNodeType);

  edges.push({
    id: "edge-chef-manager",
    source: "chef",
    target: "agent-manager",
    type: "smoothstep",
    style: { ...DEFAULT_EDGE_STYLE, stroke: "#fbbf24" },
    animated: true,
  });

  // Sub-agents
  HARDCODED_AGENTS.forEach((def, i) => {
    const nodeId = `agent-${def.id}`;
    const live = agentLookup.get(def.id);
    const liveModel = typeof live?.model === "string"
      ? live.model
      : (live?.model as Record<string, string> | undefined)?.primary;

    nodes.push({
      id: nodeId,
      type: "hierarchy",
      position: { x: startX + i * nodeSpacing, y: agentY },
      style: { width: SUB_AGENT_SIZE.width, height: SUB_AGENT_SIZE.height },
      data: {
        label: live?.name ?? def.name,
        emoji: live?.emoji ?? def.emoji,
        role: def.role,
        model: liveModel,
        isActive: getOnlineStatus(sessionActivity[def.id]) === "online",
        color: def.color,
        agentId: def.id,
        onlineStatus: getOnlineStatus(sessionActivity[def.id]),
        lastActive: formatLastActive(sessionActivity[def.id]),
        cronCount: cronCounts[def.id] ?? 0,
        onModelChange: (m: string) => callbacks.onModelChange(def.id, m),
        onChatClick: () => callbacks.onNodeClick(def.id),
        onMemoryClick: () => callbacks.onMemoryClick(def.id),
        onPingClick: () => callbacks.onPingClick(def.id),
        onSkillsClick: () => callbacks.onSkillsClick(def.id),
        onCronClick: () => callbacks.onCronClick(def.id),
        onDeleteClick: () => callbacks.onDeleteClick(def.id),
      },
    } as HierarchyNodeType);

    edges.push({
      id: `edge-manager-${def.id}`,
      source: "agent-manager",
      target: nodeId,
      type: "smoothstep",
      style: DEFAULT_EDGE_STYLE,
      animated: true,
    });
  });

  return { nodes, edges };
}

const POSITIONS_KEY = "clawdash-agent-positions";
const EDGES_KEY = "clawdash-agent-edges";

function loadSavedPositions(): Record<string, { x: number; y: number }> | null {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePositions(nodes: Node[]) {
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach(n => { positions[n.id] = n.position; });
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
}

function loadSavedEdges(): Edge[] | null {
  try {
    const raw = localStorage.getItem(EDGES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveEdges(edges: Edge[]) {
  localStorage.setItem(EDGES_KEY, JSON.stringify(edges));
}

export function HierarchyView({
  agents, sessionActivity, cronCounts,
  onNodeClick, onModelChange, onMemoryClick, onPingClick, onSkillsClick, onCronClick, onDeleteClick,
  selectedAgentId,
}: HierarchyViewProps) {
  const callbacks = useMemo(() => ({
    onNodeClick, onModelChange, onMemoryClick, onPingClick, onSkillsClick, onCronClick, onDeleteClick,
  }), [onNodeClick, onModelChange, onMemoryClick, onPingClick, onSkillsClick, onCronClick, onDeleteClick]);

  const initialLayout = useMemo(
    () => {
      const layout = buildLayout(agents, sessionActivity, cronCounts, callbacks);
      const savedPositions = loadSavedPositions();
      if (savedPositions) {
        layout.nodes = layout.nodes.map(n => {
          const saved = savedPositions[n.id];
          return saved ? { ...n, position: saved } : n;
        });
      }
      const savedEdges = loadSavedEdges();
      if (savedEdges) {
        layout.edges = savedEdges;
      }
      return layout;
    },
    [agents, sessionActivity, cronCounts, callbacks]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayout.edges);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  const resetLayout = useCallback(() => {
    localStorage.removeItem(POSITIONS_KEY);
    localStorage.removeItem(EDGES_KEY);
    const layout = buildLayout(agents, sessionActivity, cronCounts, callbacks);
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [agents, sessionActivity, cronCounts, callbacks, setNodes, setEdges]);

  // Update node data when activity/cron changes without resetting positions
  useMemo(() => {
    const layout = buildLayout(agents, sessionActivity, cronCounts, callbacks);
    const dataMap = new Map(layout.nodes.map(n => [n.id, n.data]));
    setNodes(prev => prev.map(n => {
      const newData = dataMap.get(n.id);
      return newData ? { ...n, data: newData } : n;
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionActivity, cronCounts]);

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
          strokeWidth: related ? 3 : (e.style?.strokeWidth as number),
        },
      };
    });
  }, [edges, highlightedNodeId]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id === "chef") return;
    const agentId = (node.data as { agentId?: string }).agentId ?? null;
    onNodeClick(agentId);
  }, [onNodeClick]);

  const handleNodeDragStop = useCallback(() => {
    setTimeout(() => {
      setNodes(currentNodes => {
        savePositions(currentNodes);
        return currentNodes;
      });
    }, 0);
  }, [setNodes]);

  const handleConnect = useCallback((connection: Connection) => {
    setEdges(eds => {
      const newEdges = addEdge({
        ...connection,
        type: "smoothstep",
        style: DEFAULT_EDGE_STYLE,
        animated: true,
      }, eds);
      saveEdges(newEdges);
      return newEdges;
    });
  }, [setEdges]);

  return (
    <div className="relative w-full h-full">
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
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onNodeMouseEnter={(_, node) => setHighlightedNodeId(node.id)}
        onNodeMouseLeave={() => setHighlightedNodeId(null)}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        defaultEdgeOptions={{ type: "smoothstep", animated: true, style: DEFAULT_EDGE_STYLE }}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.15}
        maxZoom={1.5}
        className="z-0"
      >
        <Background color="#52525b" gap={24} size={1.5} className="opacity-30" />
      </ReactFlow>
    </div>
  );
}
