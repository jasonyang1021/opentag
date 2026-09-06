import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

// Static wiring regressions complement the live membership integration suite.
test("composer obtains candidates from the channel roster, not the workspace directory", () => {
  const src = read("../web/src/views/Composer.tsx");
  assert.match(src, /useMentionRoster\(channelId, atQuery !== null\)/);
  assert.match(src, /const cands = atQuery === null \? \[\] : roster\.members\.map/);
});

test("roster fences stale responses and never falls back after a failed load", () => {
  const src = read("../web/src/lib/useMentionRoster.ts");
  assert.ok(src.includes('const scope = `${serverId}:${channelId}`'));
  assert.match(src, /roster.scope === scope/);
  assert.match(src, /if \(active\) setRoster/);
  assert.match(src, /active = false/);
  assert.match(src, /status: "error", members: \[\]/);
  assert.match(src, /channel:members-updated/);
  assert.match(src, /revision, menuOpen/);
});

test("candidate endpoint checks tenant and read access before returning the shared roster", () => {
  const src = read("../src/server/routes-api/channels.ts");
  const section = src.slice(src.indexOf("const mentionRoster"), src.indexOf("const cmem"));
  assert.match(section, /eq\(schema.channels.serverId, serverId\)/);
  assert.match(section, /canUserReadChannel\(serverId, id, userId\)/);
  assert.match(section, /members: await mentionableMembers\(serverId, ch\)/);
});
