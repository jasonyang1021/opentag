import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { serializeAgentLifecycle } from "../src/server/agentLifecycleQueue.js";
import { runAgentRestore } from "../src/server/agentRestoreRunner.js";

test("restores missing agents once, carrying accepted queued starts into catch-up inventory", async () => {
  const started: string[] = [];
  const result = await runAgentRestore({
    candidates: ["running", "a", "a", "b"], runningIds: ["running"], isCurrent: () => true,
    start: async (id) => { started.push(id); return { ok: true }; }, report: () => {},
  });
  assert.deepEqual(started, ["a", "b"]);
  assert.deepEqual(result, ["running", "a", "b"]);
});

test("failed/throwing starts do not prevent remaining agents from restoring", async () => {
  const reports: boolean[] = [];
  const result = await runAgentRestore({
    candidates: ["nack", "throw", "ok"], runningIds: [], isCurrent: () => true,
    start: async (id) => { if (id === "throw") throw new Error("offline"); return { ok: id === "ok" }; },
    report: (_, result) => { reports.push(result.ok); },
  });
  assert.deepEqual(reports, [false, false, true]);
  assert.deepEqual(result, ["ok"]);
});

test("old socket stops restoring after replacement/disconnect", async () => {
  let current = true;
  const started: string[] = [];
  await runAgentRestore({
    candidates: ["a", "b"], runningIds: [], isCurrent: () => current,
    start: async (id) => { started.push(id); current = false; return { ok: false }; }, report: () => {},
  });
  assert.deepEqual(started, ["a"]);
});

test("explicit stop queued during restore wins final state", async () => {
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const events: string[] = [];
  const restore = serializeAgentLifecycle("s", "a", async () => { await barrier; events.push("start"); });
  const stop = serializeAgentLifecycle("s", "a", async () => { events.push("stop"); });
  await Promise.resolve();
  assert.deepEqual(events, []);
  release();
  await Promise.all([restore, stop]);
  assert.deepEqual(events, ["start", "stop"]);
});

test("a stop before restore is rechecked inside FIFO, not from candidate snapshot", async () => {
  let enabled = true;
  let starts = 0;
  const stop = serializeAgentLifecycle("s", "b", async () => { enabled = false; });
  const restore = serializeAgentLifecycle("s", "b", async () => { if (enabled) starts++; });
  await Promise.all([stop, restore]);
  assert.equal(starts, 0);
});

test("failed lifecycle releases FIFO and unrelated agents/tenants are independent", async () => {
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const failed = serializeAgentLifecycle("s", "c", async () => { await barrier; throw new Error("nack"); });
  const failure = assert.rejects(failed, /nack/);
  assert.equal(await serializeAgentLifecycle("other", "c", async () => "independent"), "independent");
  assert.equal(await serializeAgentLifecycle("s", "d", async () => "independent"), "independent");
  const next = serializeAgentLifecycle("s", "c", async () => "released");
  release();
  await failure;
  assert.equal(await next, "released");
});

// Wiring guards supplement the deterministic runner tests; they are not DB/WS E2E.
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("candidate selection and final restore check both bind tenant, machine and live intent", () => {
  for (const path of ["src/server/agentAutoRestore.ts", "src/server/agentRunIntent.ts"]) {
    const code = source(path);
    assert.match(code, /eq\(schema\.agents\.serverId, serverId\)/);
    assert.match(code, /eq\(schema\.agents\.machineId, (?:context\.)?machineId\)/);
    assert.match(code, /eq\(schema\.agents\.autoRestore, true\)/);
    assert.match(code, /isNull\(schema\.agents\.deletedAt\)/);
  }
  assert.match(source("src/server/agentRunIntent.ts"), /context\.isCurrent\(\) && \(agent\.status === "inactive" \|\| agent\.status === "sleeping"\)/);
});

test("explicit lifecycle records intent under FIFO while transient status does not", () => {
  const core = source("src/server/core.ts");
  assert.match(core, /setAgentRunIntent\(serverId, agentId, true\)/);
  for (const action of ["stop", "reset", "dequeue"]) {
    const section = core.slice(core.indexOf(`export async function ${action}Agent`));
    assert.match(section.slice(0, section.indexOf(`async function ${action}AgentNow`)),
      /serializeAgentLifecycle[\s\S]*setAgentRunIntent\(serverId, agentId, false\)/);
  }
  assert.doesNotMatch(source("src/server/machineLiveness.ts"), /autoRestore|setAgentRunIntent/);
  assert.doesNotMatch(source("src/server/ws.ts"), /autoRestore:|setAgentRunIntent/);
});

test("ready restores once per socket before catch-up using refreshed inventory", () => {
  const ws = source("src/server/ws.ts");
  assert.match(ws, /alreadyCurrent \? runningIds\s*: await restoreAgentsOnMachine/);
  assert.match(ws, /catchUpAgentsOnMachine\(serverId!, readyMachineId, restoredIds\)/);
  assert.ok(ws.indexOf("const restoredIds") < ws.indexOf("await resumeConversationTurnsForMachine"));
});

test("migration is additive, transactional and seeds only on first column creation", () => {
  const migration = source("scripts/migrate-agent-auto-restore.mjs");
  assert.match(migration, /sql\.begin/);
  assert.match(migration, /LOCK TABLE public\.agents IN ACCESS EXCLUSIVE MODE/);
  assert.ok(migration.indexOf("if (column) return") < migration.indexOf("UPDATE public.agents"));
  assert.match(migration, /deleted_at IS NULL AND status IN \('active', 'starting', 'queued', 'sleeping'\)/);
  assert.doesNotMatch(migration, /DROP |DELETE FROM/);
  assert.match(JSON.parse(source("package.json")).scripts["db:push"], /migrate-agent-auto-restore\.mjs && drizzle-kit push/);
  assert.match(source("Dockerfile"), /COPY --from=build \/app\/scripts\/migrate-agent-auto-restore\.mjs \.\/scripts\/migrate-agent-auto-restore\.mjs/);
});
