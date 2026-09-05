import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMemberGraph,
  connectedMemberKeys,
  layoutMemberGraph,
  summarizeChannels,
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
};

test("member graph projects shared channels into unique weighted member links", () => {
  const graph = buildMemberGraph(data);
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 3);
  const shared = graph.edges.find((edge) => edge.sourceKey === "agent:a1" && edge.targetKey === "human:u1");
  assert.deepEqual(shared?.channelIds, ["c1", "c2"]);
  assert.equal(shared?.weight, 2);
  assert.equal(graph.nodes.find((node) => node.id === "u1")?.connections, 2);
});

test("member focus includes direct collaborators and deterministic layout stays in bounds", () => {
  const graph = buildMemberGraph(data);
  const keys = connectedMemberKeys(data.humans[0]!, graph.edges);
  assert.deepEqual([...keys].sort(), ["agent:a1", "agent:a2", "human:u1"]);
  const first = layoutMemberGraph(graph.nodes, graph.edges, 600, 400);
  const second = layoutMemberGraph(graph.nodes, graph.edges, 600, 400);
  assert.deepEqual(first, second);
  assert.ok(first.every((node) => node.x >= 42 && node.x <= 558 && node.y >= 42 && node.y <= 358));
});

test("largest channels report separate human and agent totals", () => {
  assert.deepEqual(summarizeChannels(data, 1), [{ id: "c1", name: "product", humanCount: 1, agentCount: 2, total: 3 }]);
});
