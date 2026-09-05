import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { channelMentionCandidates } from "../web/src/views/Composer.tsx";

const roster = {
  channelId: "channel-a",
  agents: [
    { id: "agent-in", name: "AgentOne", displayName: "Agent One", avatarUrl: null },
  ],
  humans: [
    { userId: "human-in", name: "René", displayName: "René Member", avatarUrl: null },
  ],
};

test("mention autocomplete returns only members of the active conversation", () => {
  assert.deepEqual(channelMentionCandidates(roster, "channel-a", "").map((candidate) => candidate.name), ["AgentOne", "René"]);
  assert.deepEqual(channelMentionCandidates(roster, "channel-b", ""), []);
});

test("mention autocomplete keeps normalized case-insensitive matching", () => {
  assert.deepEqual(channelMentionCandidates(roster, "channel-a", "agent").map((candidate) => candidate.name), ["AgentOne"]);
  assert.deepEqual(channelMentionCandidates(roster, "channel-a", "RENE\u0301").map((candidate) => candidate.name), ["René"]);
});

test("composer reloads the scoped roster after membership changes", () => {
  const composer = fs.readFileSync(new URL("../web/src/views/Composer.tsx", import.meta.url), "utf8");
  const store = fs.readFileSync(new URL("../web/src/store.tsx", import.meta.url), "utf8");
  assert.match(composer, /\/api\/channels\/\$\{channelId\}\/members/);
  assert.match(composer, /event\.type === "channel:members-updated" && event\.channelId === channelId/);
  assert.match(store, /dispatch\(\{ type: "channel:members-updated", \.\.\.p \}\)/);
});
