import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isHumanOnlyAddressedMessage as suppress } from "../src/server/conversationTurnPolicy.ts";

test("human-only mentions suppress automatic ownership in public/private channels and threads", () => {
  for (const channel of ["channel", "private", "thread"]) {
    assert.equal(suppress("user", channel, [{ type: "user" }]), true);
    assert.equal(suppress("user", channel, [{ type: "user" }, { type: "user" }]), true);
  }
});
test("plain messages retain ambient ownership; explicit agent mentions and DMs retain delivery", () => {
  assert.equal(suppress("user", "channel", []), false);
  assert.equal(suppress("user", "channel", [{ type: "agent" }]), false);
  assert.equal(suppress("user", "channel", [{ type: "user" }, { type: "agent" }]), false);
  assert.equal(suppress("user", "dm", [{ type: "user" }]), false);
  assert.equal(suppress("agent", "channel", [{ type: "user" }]), false);
  assert.equal(suppress("system", "channel", [{ type: "user" }]), false);
});
test("reservation and final dispatch both apply the policy; all resolved mentions are burst boundaries", () => {
  const dispatch = readFileSync(new URL("../src/server/conversationTurnDispatch.ts", import.meta.url), "utf8");
  assert.match(dispatch, /isHumanOnlyAddressedMessage\(turn.senderType, channel.type, mentions\)/);
  assert.match(dispatch, /isHumanOnlyAddressedMessage\(claimed.senderType, channel.type, resolvedMentions\)/);
  const core = readFileSync(new URL("../src/server/core.ts", import.meta.url), "utf8");
  assert.match(core, /const addressed = mentions.length > 0/);
  assert.match(core, /ch\?\.type === "dm" \|\| addressed/);
  assert.match(core, /settleImmediately: humanOnlyAddressed/);
  const turns = readFileSync(new URL("../src/server/conversationTurns.ts", import.meta.url), "utf8");
  assert.match(turns, /input.settleImmediately \? 0 : dispatchDelay/);
});
