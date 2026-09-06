import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectPosition } from "../web/src/selectPosition.js";
test("long dropdown opens upward near viewport bottom", () => {
  const p = selectPosition({ left: 200, top: 650, bottom: 680, width: 300 }, 900, 720);
  assert.equal(p.bottom, 76); assert.equal(p.maxHeight, 280);
});
test("small viewport bounds both dropdown height and horizontal edge", () => {
  const p = selectPosition({ left: 240, top: 150, bottom: 180, width: 300 }, 320, 320);
  assert.equal(p.left, 12); assert.equal(p.maxHeight, 136);
  assert.ok(p.width + p.left <= 312);
});
test("dropdown opens downward when space permits", () => {
  const p = selectPosition({ left: 20, top: 30, bottom: 60, width: 200 }, 900, 720);
  assert.equal(p.top, 66); assert.equal(p.maxHeight, 280);
});
test("creation rejects stale choices and only accepts CLI-sourced models", () => {
  const src = readFileSync(new URL("../web/src/views/Members.tsx", import.meta.url), "utf8");
  const modal = src.slice(src.indexOf("export function CreateAgentModal"));
  assert.match(modal, /d.source === "cli" && Array.isArray\(d.models\)/);
  assert.match(modal, /loadedKey !== selectionKey/);
  assert.match(modal, /RUNTIMES.filter/);
  assert.match(modal, /setModel\(ms.length \? LOCAL_DEFAULT : ""\)/);
});
test("endpoint checks tenant, status and runtime before discovery; no presets", () => {
  const src = readFileSync(new URL("../src/server/routes-api/servers.ts", import.meta.url), "utf8");
  assert.match(src, /eq\(schema.machines.serverId, serverId\)/);
  assert.ok(src.indexOf('owns.status !== "online"') < src.indexOf("await getDynamicModels"));
  assert.match(src, /owns.runtimes.includes\(runtime\)/);
  assert.doesNotMatch(src, /CODEX_FALLBACK_MODELS|const MODELS/);
});
