import test from "node:test";
import assert from "node:assert/strict";
import { connectedNodeKeys, layoutCollaborationGraph, type CollaborationGraphData } from "../web/src/lib/collaborationGraph.ts";

const data: CollaborationGraphData = {
  humans: [{ id: "u1", type: "human", name: "you" }],
  agents: [{ id: "a1", type: "agent", name: "builder" }, { id: "a2", type: "agent", name: "reviewer" }],
  channels: [{ id: "c1", type: "channel", name: "product" }],
  memberships: [
    { channelId: "c1", memberType: "human", memberId: "u1" },
    { channelId: "c1", memberType: "agent", memberId: "a1" },
  ],
};

test("layout drops links whose endpoint type is filtered out", () => {
  const layout = layoutCollaborationGraph(data, new Set(["agent", "channel"]));
  assert.equal(layout.nodes.length, 3);
  assert.deepEqual(layout.memberships, [{ channelId: "c1", memberType: "agent", memberId: "a1" }]);
  assert.equal(layout.nodes.find((node) => node.id === "a1")?.connections, 1);
  assert.equal(layout.nodes.find((node) => node.id === "a2")?.connections, 0);
});

test("connected node focus includes only direct graph neighbors", () => {
  const keys = connectedNodeKeys(data.channels[0]!, data.memberships);
  assert.deepEqual([...keys].sort(), ["agent:a1", "channel:c1", "human:u1"]);
});
