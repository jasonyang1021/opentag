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
}

export interface PositionedCollaborationNode extends CollaborationNode {
  x: number;
  y: number;
  connections: number;
}

const columnX: Record<CollaborationNodeType, number> = { human: 15, channel: 50, agent: 85 };

/** Stable three-column layout: humans → channels → agents. It stays readable at large team sizes and needs no animation library. */
export function layoutCollaborationGraph(data: CollaborationGraphData, visible: Set<CollaborationNodeType>) {
  const nodes = [...data.humans, ...data.channels, ...data.agents].filter((node) => visible.has(node.type));
  const keys = new Set(nodes.map((node) => `${node.type}:${node.id}`));
  const memberships = data.memberships.filter((membership) =>
    keys.has(`channel:${membership.channelId}`) && keys.has(`${membership.memberType}:${membership.memberId}`));
  const degree = new Map<string, number>();
  for (const membership of memberships) {
    const memberKey = `${membership.memberType}:${membership.memberId}`;
    const channelKey = `channel:${membership.channelId}`;
    degree.set(memberKey, (degree.get(memberKey) ?? 0) + 1);
    degree.set(channelKey, (degree.get(channelKey) ?? 0) + 1);
  }
  const byType = (type: CollaborationNodeType) => nodes
    .filter((node) => node.type === type)
    .sort((a, b) => (degree.get(`${b.type}:${b.id}`) ?? 0) - (degree.get(`${a.type}:${a.id}`) ?? 0)
      || (a.displayName || a.name).localeCompare(b.displayName || b.name));
  const largestColumn = Math.max(1, ...(["human", "channel", "agent"] as const).map((type) => byType(type).length));
  const height = Math.max(560, largestColumn * 58 + 80);
  const positioned: PositionedCollaborationNode[] = [];
  for (const type of ["human", "channel", "agent"] as const) {
    const group = byType(type);
    const gap = height / (group.length + 1);
    group.forEach((node, index) => positioned.push({
      ...node,
      x: columnX[type],
      y: gap * (index + 1),
      connections: degree.get(`${node.type}:${node.id}`) ?? 0,
    }));
  }
  return { nodes: positioned, memberships, height };
}

export function connectedNodeKeys(node: CollaborationNode, memberships: CollaborationMembership[]) {
  const ownKey = `${node.type}:${node.id}`;
  const keys = new Set([ownKey]);
  for (const membership of memberships) {
    const memberKey = `${membership.memberType}:${membership.memberId}`;
    const channelKey = `channel:${membership.channelId}`;
    if (ownKey === memberKey) keys.add(channelKey);
    if (ownKey === channelKey) keys.add(memberKey);
  }
  return keys;
}
