import test from "node:test";
import assert from "node:assert/strict";
import { messageNoticeKind, taskNoticeKind, notificationPath, viewingNotice } from "../web/src/lib/desktopNotificationPolicy.ts";
const message = { id: "m1", channelId: "c1", senderType: "agent", senderId: "a1" };

test("only structured human mentions or own DMs notify", () => {
  assert.equal(messageNoticeKind(message, "u1", false), null);
  assert.equal(messageNoticeKind(message, "u1", true), "dm");
  assert.equal(messageNoticeKind({ ...message, mentions: [{ type: "user", id: "u1" }] }, "u1", false), "mention");
  assert.equal(messageNoticeKind({ ...message, mentions: [{ type: "agent", id: "u1" }] }, "u1", false), null);
  assert.equal(messageNoticeKind({ ...message, senderType: "user", senderId: "u1" }, "u1", true), null);
  assert.equal(messageNoticeKind({ ...message, senderType: "system" }, "u1", true), null);
});
test("only explicit review/completion events on my tasks notify", () => {
  const task = { ...message, taskStatus: "in_review", taskAssigneeType: "user", taskAssigneeId: "u1" };
  assert.equal(taskNoticeKind(task, "u1", {}), "in_review");
  assert.equal(taskNoticeKind(task, "u1"), null);
  assert.equal(taskNoticeKind(task, "u2", {}), null);
  assert.equal(taskNoticeKind(task, "u1", {}, "in_review"), null);
  assert.equal(taskNoticeKind(task, "u1", { actorType: "user", actorId: "u1" }), null);
  assert.equal(taskNoticeKind({ ...task, taskStatus: "in_progress" }, "u1", {}), null);
  assert.equal(taskNoticeKind({ ...message, senderType: "user", senderId: "u1", taskStatus: "done" }, "u1", {}), "done");
});
test("deep links remain same-app and active conversation stays quiet", () => {
  assert.equal(notificationPath("team", message), "/s/team/channel/c1?msg=m1");
  assert.equal(notificationPath("a/b", { ...message, channelId: "c?x" }), "/s/a%2Fb/channel/c%3Fx?msg=m1");
  assert.equal(viewingNotice("/s/team/channel/c1", "", "team", message, true), true);
  assert.equal(viewingNotice("/s/team/channel/c1", "", "team", message, false), false);
  assert.equal(viewingNotice("/s/other/channel/c1", "", "team", message, true), false);
  assert.equal(viewingNotice("/s/team/channel/c2", "?thread=m1", "team", message, true), true);
});
