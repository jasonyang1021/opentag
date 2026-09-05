export type CollaborationNodeType = "human" | "agent" | "channel";

export interface CollaborationNode {
  id: string;
  type: CollaborationNodeType;
  name: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  status?: string | null;
}

export interface CollaborationMembership {
  channelId: string;
  memberType: "human" | "agent";
  memberId: string;
}

export interface CollaborationGraphData {
  humans: CollaborationNode[];
  agents: CollaborationNode[];
  channels: CollaborationNode[];
  memberships: CollaborationMembership[];
  interactions: CollaborationInteraction[];
}

export interface CollaborationInteraction {
  sourceType: "human" | "agent";
  sourceId: string;
  targetType: "human" | "agent";
  targetId: string;
  weight: number;
}

export interface MemberConnection {
  sourceKey: string;
  targetKey: string;
  channelIds: string[];
  weight: number;
}

export interface MemberGraphNode extends CollaborationNode {
  connections: number;
}

export interface PositionedMemberGraphNode extends MemberGraphNode {
  x: number;
  y: number;
}

export interface ChannelSummary {
  id: string;
  name: string;
  humanCount: number;
  agentCount: number;
  total: number;
}

export const memberNodeKey = (node: Pick<CollaborationNode, "type" | "id">) => `${node.type}:${node.id}`;

/**
 * The visible graph is people + agents. Server-side interaction evidence (mentions,
 * replies, thread participation, and assignments) becomes a weighted undirected edge.
 */
export function buildMemberGraph(data: CollaborationGraphData) {
  const sourceNodes = [...data.humans, ...data.agents];
  const nodesByKey = new Map(sourceNodes.map((node) => [memberNodeKey(node), node]));
  const edges: MemberConnection[] = data.interactions.flatMap((interaction) => {
    const endpoints = [`${interaction.sourceType}:${interaction.sourceId}`, `${interaction.targetType}:${interaction.targetId}`].sort();
    if (endpoints[0] === endpoints[1] || !nodesByKey.has(endpoints[0]!) || !nodesByKey.has(endpoints[1]!)) return [];
    return [{ sourceKey: endpoints[0]!, targetKey: endpoints[1]!, channelIds: [], weight: Math.max(1, interaction.weight) }];
  });
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.sourceKey, (degree.get(edge.sourceKey) ?? 0) + 1);
    degree.set(edge.targetKey, (degree.get(edge.targetKey) ?? 0) + 1);
  }
  const nodes: MemberGraphNode[] = sourceNodes.map((node) => ({ ...node, connections: degree.get(memberNodeKey(node)) ?? 0 }));
  return { nodes, edges };
}

export function summarizeChannels(data: CollaborationGraphData, limit = 6): ChannelSummary[] {
  const counts = new Map(data.channels.map((channel) => [channel.id, { humanCount: 0, agentCount: 0 }]));
  for (const membership of data.memberships) {
    const count = counts.get(membership.channelId);
    if (!count) continue;
    if (membership.memberType === "human") count.humanCount++;
    else count.agentCount++;
  }
  return data.channels.map((channel) => {
    const count = counts.get(channel.id) ?? { humanCount: 0, agentCount: 0 };
    return { id: channel.id, name: channel.name, ...count, total: count.humanCount + count.agentCount };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, limit);
}

const hash = (value: string) => {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
};

/** Deterministic force layout keeps refreshes stable while clustering linked members. */
export function layoutMemberGraph(nodes: MemberGraphNode[], edges: MemberConnection[], width = 1040, height = 640): PositionedMemberGraphNode[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ ...nodes[0]!, x: width / 2, y: height / 2 }];
  const ordered = [...nodes].sort((a, b) => memberNodeKey(a).localeCompare(memberNodeKey(b)));
  const radius = Math.min(width, height) * 0.34;
  const positions = ordered.map((node, index) => {
    const angle = index * 2.399963229728653 + (hash(memberNodeKey(node)) % 97) / 97;
    const band = 0.66 + ((hash(node.id) >>> 8) % 34) / 100;
    return { node, x: width / 2 + Math.cos(angle) * radius * band, y: height / 2 + Math.sin(angle) * radius * band, vx: 0, vy: 0 };
  });
  const indexByKey = new Map(positions.map((position, index) => [memberNodeKey(position.node), index]));
  const indexedEdges = edges.flatMap((edge) => {
    const source = indexByKey.get(edge.sourceKey);
    const target = indexByKey.get(edge.targetKey);
    return source === undefined || target === undefined ? [] : [{ ...edge, source, target }];
  });

  for (let iteration = 0; iteration < 220; iteration++) {
    const cooling = 1 - iteration / 250;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]!;
        const b = positions[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 1) {
          dx = ((hash(a.node.id + b.node.id) % 11) - 5) / 5;
          dy = ((hash(b.node.id + a.node.id) % 11) - 5) / 5;
          distanceSquared = dx * dx + dy * dy || 1;
        }
        const distance = Math.sqrt(distanceSquared);
        const force = Math.min(2.8, 5200 / distanceSquared) * cooling;
        const fx = force * dx / distance;
        const fy = force * dy / distance;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      }
    }
    for (const edge of indexedEdges) {
      const source = positions[edge.source]!;
      const target = positions[edge.target]!;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const desired = Math.max(72, 126 - Math.min(edge.weight, 4) * 10);
      const force = (distance - desired) * 0.009 * cooling;
      const fx = force * dx / distance;
      const fy = force * dy / distance;
      source.vx += fx; source.vy += fy; target.vx -= fx; target.vy -= fy;
    }
    for (const position of positions) {
      position.vx += (width / 2 - position.x) * 0.0025;
      position.vy += (height / 2 - position.y) * 0.0025;
      position.vx *= 0.82;
      position.vy *= 0.82;
      position.x = Math.max(42, Math.min(width - 42, position.x + position.vx));
      position.y = Math.max(42, Math.min(height - 42, position.y + position.vy));
    }
  }
  return positions.map(({ node, x, y }) => ({ ...node, x, y }));
}

export function connectedMemberKeys(node: Pick<CollaborationNode, "type" | "id">, edges: MemberConnection[]) {
  const ownKey = memberNodeKey(node);
  const keys = new Set([ownKey]);
  for (const edge of edges) {
    if (edge.sourceKey === ownKey) keys.add(edge.targetKey);
    if (edge.targetKey === ownKey) keys.add(edge.sourceKey);
  }
  return keys;
}
