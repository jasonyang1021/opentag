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
    degree.set(edge.sourceKey, (degree.get(edge.sourceKey) ?? 0) + edge.weight);
    degree.set(edge.targetKey, (degree.get(edge.targetKey) ?? 0) + edge.weight);
  }
  const nodes: MemberGraphNode[] = sourceNodes.map((node) => ({ ...node, connections: degree.get(memberNodeKey(node)) ?? 0 }));
  return { nodes, edges };
}

export const MAX_VISIBLE_EDGE_STRANDS = 24;

/** Exact for normal relationships; bounded for pathological histories to keep SVG responsive. */
export function visibleEdgeStrandCount(weight: number) {
  return Math.min(MAX_VISIBLE_EDGE_STRANDS, Math.max(1, Math.round(weight)));
}

/** Keep every strand on the same side of its edge so bundles read as deliberate arcs. */
export function edgeCurveOffsets(weight: number, direction: 1 | -1, distance = 200) {
  const count = visibleEdgeStrandCount(weight);
  const bend = Math.max(30, Math.min(110, distance * 0.32));
  const spread = Math.min(150, distance * 0.65, bend * 1.6);
  return Array.from({ length: count }, (_, index) =>
    direction * (bend + (count === 1 ? 0 : (index / (count - 1) - 0.5) * spread)));
}

export function totalInteractionCount(edges: MemberConnection[]) {
  return edges.reduce((total, edge) => total + edge.weight, 0);
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

/** Linked members form a roomy centre network; unlinked members occupy a stable, pseudo-random outer ring. */
export function layoutMemberGraph(nodes: MemberGraphNode[], edges: MemberConnection[], width = 1040, height = 640): PositionedMemberGraphNode[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ ...nodes[0]!, x: width / 2, y: height / 2 }];
  const ordered = [...nodes].sort((a, b) => memberNodeKey(a).localeCompare(memberNodeKey(b)));
  const connectedKeys = new Set(edges.flatMap((edge) => [edge.sourceKey, edge.targetKey]));
  const connectedNodes = ordered.filter((node) => connectedKeys.has(memberNodeKey(node)));
  const isolatedNodes = ordered.filter((node) => !connectedKeys.has(memberNodeKey(node))).sort((a, b) => hash(memberNodeKey(a)) - hash(memberNodeKey(b)));
  const centreRadius = Math.min(width, height) * 0.27;
  const positions = connectedNodes.map((node, index) => {
    const angle = index * 2.399963229728653 + (hash(memberNodeKey(node)) % 71) / 71;
    const band = 0.58 + ((hash(node.id) >>> 8) % 35) / 100;
    return { node, x: width / 2 + Math.cos(angle) * centreRadius * band, y: height / 2 + Math.sin(angle) * centreRadius * band, vx: 0, vy: 0 };
  });
  const outerX = Math.max(42, width / 2 - 78);
  const outerY = Math.max(42, height / 2 - 80);
  isolatedNodes.forEach((node, index) => {
    const slot = 2 * Math.PI / Math.max(1, isolatedNodes.length);
    const jitter = (((hash(memberNodeKey(node)) >>> 10) % 101) / 100 - 0.5) * slot * 0.5;
    const angle = index * slot - Math.PI / 2 + jitter;
    const radial = 0.84 + (hash(node.id) % 161) / 1000;
    positions.push({ node, x: width / 2 + Math.cos(angle) * outerX * radial, y: height / 2 + Math.sin(angle) * outerY * radial, vx: 0, vy: 0 });
  });
  const indexByKey = new Map(positions.map((position, index) => [memberNodeKey(position.node), index]));
  const indexedEdges = edges.flatMap((edge) => {
    const source = indexByKey.get(edge.sourceKey);
    const target = indexByKey.get(edge.targetKey);
    return source === undefined || target === undefined ? [] : [{ ...edge, source, target }];
  });

  for (let iteration = 0; iteration < 260; iteration++) {
    const cooling = 1 - iteration / 290;
    for (let i = 0; i < connectedNodes.length; i++) {
      for (let j = i + 1; j < connectedNodes.length; j++) {
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
        const force = Math.min(3.4, 8800 / distanceSquared) * cooling;
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
      const desired = Math.max(132, 172 - Math.min(edge.weight, 8) * 5);
      const force = (distance - desired) * 0.0075 * cooling;
      const fx = force * dx / distance;
      const fy = force * dy / distance;
      source.vx += fx; source.vy += fy; target.vx -= fx; target.vy -= fy;
    }
    for (let index = 0; index < connectedNodes.length; index++) {
      const position = positions[index]!;
      position.vx += (width / 2 - position.x) * 0.0015;
      position.vy += (height / 2 - position.y) * 0.0015;
      position.vx *= 0.82;
      position.vy *= 0.82;
      position.x = Math.max(width * 0.13, Math.min(width * 0.87, position.x + position.vx));
      position.y = Math.max(height * 0.13, Math.min(height * 0.87, position.y + position.vy));
    }
  }
  // Fill the central region without letting interaction weight collapse it into a knot.
  if (connectedNodes.length > 1) {
    const central = positions.slice(0, connectedNodes.length);
    const xs = central.map((p) => p.x), ys = central.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scaleX = Math.min((width * (isolatedNodes.length ? 0.53 : 0.72)) / Math.max(1, maxX - minX), 3);
    const scaleY = Math.min((height * (isolatedNodes.length ? 0.52 : 0.68)) / Math.max(1, maxY - minY), 2.5);
    for (const p of central) {
      p.x = width / 2 + (p.x - (minX + maxX) / 2) * scaleX;
      p.y = height / 2 + (p.y - (minY + maxY) / 2) * scaleY;
    }
  }
  // Resolve avatar/label collisions across BOTH groups, including near the outer band.
  for (let pass = 0; pass < 40; pass++) {
    for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i]!, b = positions[j]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const overlapX = 108 - Math.abs(dx), overlapY = 82 - Math.abs(dy);
      if (overlapX <= 0 || overlapY <= 0) continue;
      if (overlapX < overlapY) {
        const shift = (overlapX + 1) / 2 * (dx < 0 ? -1 : 1);
        a.x -= shift; b.x += shift;
      } else {
        const shift = (overlapY + 1) / 2 * (dy < 0 ? -1 : 1);
        a.y -= shift; b.y += shift;
      }
    }
    for (const p of positions) {
      p.x = Math.max(64, Math.min(width - 64, p.x));
      p.y = Math.max(48, Math.min(height - 66, p.y));
    }
  }
  return positions.map(({ node, x, y }) => ({ ...node, x, y }));
}

export function filterMemberGraph(graph: ReturnType<typeof buildMemberGraph>, type: "all" | "human" | "agent", minimum: number, hideIsolated: boolean) {
  const candidates = graph.nodes.filter((node) => type === "all" || node.type === type);
  const keys = new Set(candidates.map(memberNodeKey));
  const edges = graph.edges.filter((edge) => edge.weight >= minimum && keys.has(edge.sourceKey) && keys.has(edge.targetKey));
  const totals = new Map<string, number>();
  for (const edge of edges) for (const key of [edge.sourceKey, edge.targetKey]) totals.set(key, (totals.get(key) ?? 0) + edge.weight);
  const nodes = candidates.map((node) => ({ ...node, connections: totals.get(memberNodeKey(node)) ?? 0 }))
    .filter((node) => !hideIsolated || node.connections > 0);
  return { nodes, edges };
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
