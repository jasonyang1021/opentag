import assert from "node:assert/strict";
import test from "node:test";
import { avatarHash, colorAvatarSvg, colorAvatarUri, generatedChoice } from "./colorAvatars.js";

test("avatars are deterministic, Unicode-safe and different by member kind", () => {
  assert.equal(avatarHash("é"), avatarHash("e\u0301"));
  assert.equal(colorAvatarUri("Cindy", "robot"), colorAvatarUri("Cindy", "robot"));
  assert.notEqual(colorAvatarUri("Cindy", "robot"), colorAvatarUri("Cindy", "animal"));
});
test("all animal silhouettes and robot faces have variation without user markup", () => {
  const animals = new Set<string>();
  for (let i = 0; i < 150; i++) animals.add(colorAvatarSvg(`member-${i}`, "animal"));
  assert.ok(animals.size >= 30);
  const svg = colorAvatarSvg('<script>alert("x")</script>', "animal");
  assert.ok(!svg.includes("<script"));
  assert.ok(!svg.includes("undefined"));
  assert.ok(svg.includes('viewBox="0 0 64 64"'));
});
test("versioned choices round-trip while real uploads and legacy choices are untouched", () => {
  assert.deepEqual(generatedChoice("tagora:v1:robot:中文:123"), { kind: "robot", seed: "中文:123" });
  assert.deepEqual(generatedChoice("tagora:v1:animal:"), { kind: "animal", seed: "" });
  for (const url of [null, "", "/api/attachments/id", "https://example.com/avatar.png", "dicebear:seed", "pixel:random:seed", "tagora:v2:animal:seed"]) assert.equal(generatedChoice(url), null);
});
