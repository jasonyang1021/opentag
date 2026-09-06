import assert from "node:assert/strict";
import test from "node:test";
import { matchesThreadParent, selectChatTab, selectNavigationChannel, type NavigationChannel } from "./channelNavigation.js";

const all: NavigationChannel = { id: "public", name: "all", type: "channel" };
const nested = { id: "nested", name: "thread-parent", type: "thread", audit: true };
test("missing explicit channel never falls back to all", () => {
  assert.equal(selectNavigationChannel("missing", [all], null), undefined);
  assert.equal(selectNavigationChannel(undefined, [all], null), all);
});
test("nested task/inbox URL resolves the internal thread without adding it to the sidebar", () => {
  assert.equal(selectNavigationChannel("nested", [all], nested), nested);
  assert.equal(selectNavigationChannel("public", [all], nested), all);
});
test("stale resolution for another channel cannot expose its messages", () => {
  assert.equal(selectNavigationChannel("another", [all], nested), undefined);
});
test("audit status survives thread resolution", () => {
  assert.equal(selectNavigationChannel("nested", [all], nested)?.audit, true);
});
test("thread and message links override an old tasks tab", () => {
  for (const q of ["thread=parent&chatTab=tasks", "msg=reply&chatTab=files"]) {
    assert.equal(selectChatTab(new URLSearchParams(q), false), "chat");
  }
  assert.equal(selectChatTab(new URLSearchParams("chatTab=tasks"), false), "tasks");
  assert.equal(selectChatTab(new URLSearchParams("chatTab=tasks"), true), "chat");
});
test("thread links support full, short and channel-prefixed message IDs", () => {
  const id = "12345678-abcd-1234-1234-123456789abc";
  for (const target of [id, "12345678", "channel:12345678"]) assert.equal(matchesThreadParent(target, id), true);
  assert.equal(matchesThreadParent("87654321", id), false);
  assert.equal(matchesThreadParent("channel:", id), false);
});
