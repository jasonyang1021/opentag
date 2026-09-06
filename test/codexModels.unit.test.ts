import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { discoverCodexModels, parseCodexModelPage } from "../src/daemon/codexModels.js";

const fixture = fileURLToPath(new URL("./fixtures/codex-models.mjs", import.meta.url));
test("model/list handshake, all pages, Unicode, hidden models and reasoning", async () => {
  const result = await discoverCodexModels(3000, (_cmd, _args, opts) => spawn(process.execPath, [fixture], opts));
  assert.deepEqual(result?.map(m => m.id), ["gpt-6-astra", "second-model"]);
  assert.equal(result?.[0]?.label, "测试 GPT-6");
  assert.equal(result?.[0]?.thinking?.default, "high");
});
for (const mode of ["error", "loop", "timeout"]) test(`model/list ${mode} fails without a fallback`, async () => {
  const result = await discoverCodexModels(mode === "timeout" ? 150 : 3000,
    (_cmd, _args, opts) => spawn(process.execPath, [fixture], { ...opts, env: { ...opts.env, MODEL_TEST_MODE: mode } }));
  assert.equal(result, null);
});
test("model/list rejects malformed pages", () => {
  assert.throws(() => parseCodexModelPage({ models: [] }));
  assert.deepEqual(parseCodexModelPage({ data: [null, {}, { model: "secret", hidden: true }] }), []);
});
