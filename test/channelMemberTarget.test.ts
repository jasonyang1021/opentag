import test from "node:test";
import assert from "node:assert/strict";
import { channelMemberTarget } from "../src/server/channelMemberTarget.ts";
const id = "12345678-1234-1234-1234-123456789abc";
test("accepts exactly one UUID human/agent target", () => {
  assert.deepEqual(channelMemberTarget({ userId: id }), { type: "user", id });
  assert.deepEqual(channelMemberTarget({ agentId: id }), { type: "agent", id });
});
test("rejects ambiguous, missing, malformed and non-string member targets", () => {
  for (const body of [null, [], {}, { userId: null }, { userId: 123 }, { userId: "invalid" }, { userId: id, agentId: id }, { userId: null, agentId: id }]) assert.equal(channelMemberTarget(body), null);
});
