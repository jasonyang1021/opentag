import { createInterface } from "node:readline";
let initialized = false;
createInterface({ input: process.stdin }).on("line", line => {
  const m = JSON.parse(line), mode = process.env.MODEL_TEST_MODE;
  const send = result => process.stdout.write(JSON.stringify({ id: m.id, result }) + "\n");
  if (mode === "timeout") return;
  if (m.method === "initialize") return send({});
  if (m.method === "initialized") { initialized = true; return; }
  if (!initialized || m.method !== "model/list") process.exit(2);
  if (mode === "error") return process.stdout.write(JSON.stringify({ id: m.id, error: { message: "login required" } }) + "\n");
  send({ data: [{ model: m.params.cursor ? "second-model" : "gpt-6-astra", displayName: "测试 GPT-6", hidden: false,
    isDefault: !m.params.cursor, supportedReasoningEfforts: [{ reasoningEffort: "high" }], defaultReasoningEffort: "high" },
    { model: "hidden-model", hidden: true }], nextCursor: mode === "loop" || !m.params.cursor ? "page2" : null });
});
