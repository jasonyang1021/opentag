import test from "node:test";
import assert from "node:assert/strict";
import { evictHumanChannelSessions } from "../src/server/channelMembershipEvents.ts";
test("leave evicts every tab of the target Human, but no other Human or workspace", async () => {
  const make = (uid: string, serverId: string) => ({ data: { uid, serverId }, rooms: [] as string[], events: [] as unknown[], async leave(room: string) { this.rooms.push(room); }, emit(event: string, payload: unknown) { this.events.push([event, payload]); } });
  const tabs = [make("human", "workspace"), make("human", "workspace"), make("other", "workspace"), make("human", "foreign")];
  await evictHumanChannelSessions(tabs, "workspace", "human", ["root", "thread"]);
  for (const tab of tabs.slice(0, 2)) {
    assert.deepEqual(tab.rooms, ["channel:root", "channel:thread"]);
    assert.deepEqual(tab.events, [["channel:left", { channelIds: ["root", "thread"] }]]);
  }
  for (const tab of tabs.slice(2)) { assert.deepEqual(tab.rooms, []); assert.deepEqual(tab.events, []); }
});
