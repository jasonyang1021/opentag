import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LiveAgentReplies } from "../src/server/liveAgentReplies.ts";
import { recoverAgentReplyPage } from "../web/src/lib/agentReplyRecovery.ts";
import { applyAgentReplyPreview, tickAgentReplyPreviews, type AgentReplyEvent } from "../web/src/lib/agentReplyPreview.ts";
import type { Msg } from "../web/src/store.tsx";

const start: AgentReplyEvent = { type: "agent:reply", op: "start", agentId: "a", channelId: "dm-a", streamId: "r1", name: "A" };
const item = { timestamp: 1, kind: "text", text: "处理中 / 処理中" };
const activity: AgentReplyEvent = { ...start, op: "activity", entries: [item] };
const final: Msg = { id: "m1", seq: 1, channelId: "dm-a", senderId: "a", senderType: "agent", senderName: "A", content: "Done", agentActivity: [item], agentActivityStreamId: "r1", agentActivityState: "handled" };

test("switch A -> B -> A / fresh page restores the same running Activity", () => {
  const cache = new LiveAgentReplies(); cache.record("s", start); cache.record("s", activity);
  assert.deepEqual(cache.snapshot("s", "dm-b"), []);
  const restored = recoverAgentReplyPage("dm-a", [], cache.snapshot("s", "dm-a") as AgentReplyEvent[], []);
  assert.equal(restored.length, 1); assert.deepEqual(restored[0].agentActivity, [item]);
  assert.equal(restored[0].agentActivityState, "running");
  assert.equal((tickAgentReplyPreviews(restored, 0, Date.now() + 1000).messages[0] as any).streamVisible, true);
});
test("snapshots are tenant + channel isolated and detached", () => {
  const cache = new LiveAgentReplies(); cache.record("s", activity);
  assert.deepEqual(cache.snapshot("foreign", "dm-a"), []);
  cache.snapshot("s", "dm-a")[0].entries!.push({ ...item, timestamp: 2 });
  assert.equal(cache.snapshot("s", "dm-a")[0].entries!.length, 1);
});
test("completion, offline, superseding runs and expiry do not revive stale runs", () => {
  for (const end of [{ ...start, op: "done" }, { ...start, op: "error" }, { type: "agent", id: "a", activity: "offline" }]) {
    const cache = new LiveAgentReplies(); cache.record("s", start, 0); cache.record("s", end, 1); cache.record("s", activity, 2);
    assert.deepEqual(cache.snapshot("s", "dm-a", 3), []);
  }
  const cache = new LiveAgentReplies(); cache.record("s", start, 0); cache.record("s", { ...start, streamId: "r2" }, 1);
  assert.equal(cache.snapshot("s", "dm-a", 2)[0].streamId, "r2");
  assert.deepEqual(cache.snapshot("s", "dm-a", 86400002), []);
});
test("Activity has a bounded tail and durable segments own their prior entries", () => {
  const cache = new LiveAgentReplies();
  cache.record("s", { ...activity, entries: Array.from({ length: 600 }, (_, timestamp) => ({ ...item, timestamp })) });
  assert.equal(cache.snapshot("s", "dm-a")[0].entries!.length, 500);
  const owned = cache.snapshot("s", "dm-a")[0].entries;
  const concurrent = { ...item, timestamp: 601 };
  cache.record("s", { ...activity, entries: [concurrent] });
  cache.record("s", { type: "message", message: { ...final, agentActivity: owned, agentActivityState: "running" } });
  assert.deepEqual(cache.snapshot("s", "dm-a")[0].entries, [concurrent]);
});
test("missed start is repaired by subsequent Activity", () => {
  assert.deepEqual(applyAgentReplyPreview([], activity)[0].agentActivity, [item]);
  assert.deepEqual(applyAgentReplyPreview([final], activity), [final]);
});
test("HTTP snapshot plus overlapping live events has no duplicate Activity", () => {
  const snapshot = { ...start, entries: [item] };
  const restored = recoverAgentReplyPage("dm-a", [], [snapshot], [activity, { ...activity, entries: [{ ...item, timestamp: 2 }] }]);
  assert.equal(restored[0].agentActivity!.length, 2);
});
test("a terminal message returned by HTTP wins over an older running snapshot", () => {
  assert.deepEqual(recoverAgentReplyPage("dm-a", [final], [{ ...start, entries: [item] }], []), [final]);
});
test("message and completion during a history request are replayed once", () => {
  const events = [{ type: "message", message: final }, { ...start, op: "done" }];
  const result = recoverAgentReplyPage("dm-a", [], [start], events);
  assert.equal(result.length, 1); assert.equal(result[0].id, final.id); assert.equal(result[0].agentActivityState, "handled");
  assert.equal(recoverAgentReplyPage("dm-a", [final], [start], events).length, 1);
});
test("another channel's snapshot and buffered events never enter the page", () => {
  assert.deepEqual(recoverAgentReplyPage("dm-b", [], [start], [activity, { type: "message", message: final }]), []);
});
test("recovery uses existing authorization and both views protect asynchronous request identity", () => {
  const route = fs.readFileSync(new URL("../src/server/routes-api/messages.ts", import.meta.url), "utf8");
  const gate = route.indexOf('if (!(await canUserReadChannel(serverId, cmsg[1]!, userId)))');
  assert.ok(gate >= 0 && gate < route.indexOf("liveAgentReplies.snapshot(serverId, cmsg[1]!)"));
  const chat = fs.readFileSync(new URL("../web/src/views/Chat.tsx", import.meta.url), "utf8");
  assert.match(chat, /messageLoadRef.current !== request/); assert.match(chat, /threadLoadRef.current !== request/);
  assert.equal((chat.match(/e.type === "realtime:ready"/g) || []).length, 2);
});
