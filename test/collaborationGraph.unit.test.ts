import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMemberGraph,
  connectedMemberKeys,
  edgeCurveOffsets,
  filterMemberGraph,
  layoutMemberGraph,
  layoutOrbitGraph,
  shortestMemberPath,
  MAX_VISIBLE_EDGE_STRANDS,
  summarizeChannels,
  totalInteractionCount,
  visibleEdgeStrandCount,
  type CollaborationGraphData,
} from "../web/src/lib/collaborationGraph.ts";

const data: CollaborationGraphData = {
  humans: [{ id: "u1", type: "human", name: "you" }],
  agents: [{ id: "a1", type: "agent", name: "builder" }, { id: "a2", type: "agent", name: "reviewer" }],
  channels: [{ id: "c1", type: "channel", name: "product" }, { id: "c2", type: "channel", name: "design" }],
  memberships: [
    { channelId: "c1", memberType: "human", memberId: "u1" },
    { channelId: "c1", memberType: "agent", memberId: "a1" },
    { channelId: "c1", memberType: "agent", memberId: "a2" },
    { channelId: "c2", memberType: "human", memberId: "u1" },
    { channelId: "c2", memberType: "agent", memberId: "a1" },
  ],
  interactions: [
    { sourceType: "human", sourceId: "u1", targetType: "agent", targetId: "a1", weight: 5 },
    { sourceType: "agent", sourceId: "a1", targetType: "agent", targetId: "a2", weight: 2 },
  ],
};

test("member graph projects interaction evidence into weighted member links", () => {
  const graph = buildMemberGraph(data);
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 2);
  const shared = graph.edges.find((edge) => edge.sourceKey === "agent:a1" && edge.targetKey === "human:u1");
  assert.equal(shared?.weight, 5);
  assert.equal(graph.nodes.find((node) => node.id === "u1")?.connections, 5);
  assert.equal(graph.nodes.find((node) => node.id === "a1")?.connections, 7);
  assert.equal(totalInteractionCount(graph.edges), 7);
});

test("curve bundles show exact normal counts and cap pathological histories", () => {
  assert.equal(visibleEdgeStrandCount(7), 7);
  assert.equal(visibleEdgeStrandCount(1), 1);
  assert.equal(visibleEdgeStrandCount(10_000), MAX_VISIBLE_EDGE_STRANDS);
  assert.equal(new Set(edgeCurveOffsets(17, 1)).size, 17);
  assert.ok(Math.abs(edgeCurveOffsets(1, 1, 350)[0]!) > Math.abs(edgeCurveOffsets(1, 1, 100)[0]!));
  assert.ok(edgeCurveOffsets(24, -1).every(Number.isFinite));
});

test("member focus includes direct collaborators and deterministic layout stays in bounds", () => {
  const graph = buildMemberGraph(data);
  const keys = connectedMemberKeys(data.humans[0]!, graph.edges);
  assert.deepEqual([...keys].sort(), ["agent:a1", "human:u1"]);
  const first = layoutMemberGraph(graph.nodes, graph.edges, 600, 400);
  const second = layoutMemberGraph(graph.nodes, graph.edges, 600, 400);
  assert.deepEqual(first, second);
  assert.ok(first.every((node) => node.x >= 42 && node.x <= 558 && node.y >= 42 && node.y <= 358));
});

test("layout keeps linked members central and distributes isolates around the perimeter", () => {
  const graph = buildMemberGraph({ ...data, humans: [...data.humans, { id: "u2", type: "human", name: "observer" }] });
  const layout = layoutMemberGraph(graph.nodes, graph.edges, 600, 400);
  const isolated = layout.find((node) => node.id === "u2")!;
  const linked = layout.filter((node) => node.id !== "u2");
  const outerEllipse = ((isolated.x - 300) / 238) ** 2 + ((isolated.y - 200) / 142) ** 2;
  assert.ok(outerEllipse >= 0.45);
  assert.ok(linked.every((node) => node.x >= 78 && node.x <= 522 && node.y >= 52 && node.y <= 348));
});

test("filters recompute visible relationships and totals without dangling endpoints", () => {
  const graph = buildMemberGraph(data);
  const agents = filterMemberGraph(graph, "agent", 1, false);
  assert.equal(agents.nodes.length, 2);
  assert.equal(agents.edges.length, 1);
  assert.equal(totalInteractionCount(agents.edges), 2);
  assert.ok(agents.nodes.every((node) => node.connections === 2));
  const strong = filterMemberGraph(graph, "all", 3, true);
  assert.equal(strong.nodes.length, 2);
  assert.equal(totalInteractionCount(strong.edges), 5);
  assert.equal(filterMemberGraph(graph, "human", 1, true).nodes.length, 0);
  assert.equal(graph.nodes.length, 3);
});

test("largest channels report separate human and agent totals", () => {
  assert.deepEqual(summarizeChannels(data, 1), [{ id: "c1", name: "product", humanCount: 1, agentCount: 2, total: 3 }]);
});

test("orbit layout is deterministic, bounded and preserves members without changing evidence", () => {
  const graph = buildMemberGraph({ ...data, humans: [...data.humans, { id: "quiet", type: "human", name: "Quiet" }] });
  const before = structuredClone(graph.nodes);
  const positions = layoutOrbitGraph(graph.nodes, 1040, 640);
  assert.deepEqual(positions, layoutOrbitGraph([...graph.nodes].reverse(), 1040, 640));
  assert.deepEqual(graph.nodes, before);
  assert.equal(positions.length, graph.nodes.length);
  assert.ok(positions.every(p => Number.isFinite(p.x) && p.x >= 64 && p.x <= 976 && p.y >= 64 && p.y <= 565));
  assert.deepEqual(layoutOrbitGraph([], 640, 520), []);
  assert.equal(layoutOrbitGraph([graph.nodes[0]!], 640, 520)[0]!.x, 320);
});

test("connection trails use shortest existing paths and handle disconnected members and cycles", () => {
  const { edges } = buildMemberGraph(data);
  assert.deepEqual(shortestMemberPath("human:u1", "agent:a2", edges), ["human:u1", "agent:a1", "agent:a2"]);
  assert.deepEqual(shortestMemberPath("agent:a1", "human:u1", edges), ["agent:a1", "human:u1"]);
  assert.equal(shortestMemberPath("human:u1", "missing", edges), null);
  assert.deepEqual(shortestMemberPath("human:u1", "human:u1", edges), ["human:u1"]);
  const triangle = [...edges, { sourceKey: "human:u1", targetKey: "agent:a2", channelIds: [], weight: 1 }];
  assert.deepEqual(shortestMemberPath("human:u1", "agent:a2", triangle), ["human:u1", "agent:a2"]);
});
