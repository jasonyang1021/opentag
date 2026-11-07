import test from "node:test";
import assert from "node:assert/strict";
import { FILE_DELIVERY_GUIDANCE } from "../src/server/fileDeliveryPolicy.ts";

test("file delivery describes upload plus authorized final attachment send", () => {
  for (const expected of ["attachment upload --file", "--channel <authorized-reply-target>", "--reply-to <trigger-id>", "--attach <id1,id2>", "task thread", "check that message send succeeded", "draft workflow"]) assert.ok(FILE_DELIVERY_GUIDANCE.includes(expected), expected);
});
test("delivery never requests unrelated files or bypasses grants", () => {
  for (const expected of ["one-shot reply grant", "Never upload secrets", "keep files local", "never bypass permissions", "missing file", "temporary intermediates"]) assert.ok(FILE_DELIVERY_GUIDANCE.includes(expected), expected);
});

test("generated images are delivered inline as actual final attachments", () => {
  for (const expected of ["appears directly in chat", "actual final image", "attach its returned ID", "same reply", "unrequested intermediate"])
    assert.ok(FILE_DELIVERY_GUIDANCE.includes(expected), expected);
});
