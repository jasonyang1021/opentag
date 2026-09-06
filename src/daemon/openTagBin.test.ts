import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { powerShellWrapper } from "./openTagBin.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const unicode = "你好，中文\n日本語：こんにちは\n한국어 안녕하세요\n🧪🚀 café é 'quoted' $literal";
const quote = (s: string) => "'" + s.replace(/'/g, "''") + "'";

function run(shell: string, script: string, env: NodeJS.ProcessEnv) {
  return new Promise<{ code: number | null; out: string; err: string }>((resolve, reject) => {
    const child = spawn(shell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { env });
    let out = "", err = "";
    child.stdout.setEncoding("utf8").on("data", c => out += c);
    child.stderr.setEncoding("utf8").on("data", c => err += c);
    child.on("error", reject);
    child.on("close", code => resolve({ code, out, err }));
  });
}

test("PowerShell wrapper quotes paths without changing user profiles", () => {
  const shim = powerShellWrapper(["C:/a b/node.exe", "C:/a'b/cli.mjs"]);
  assert.match(shim, /'C:\/a''b\/cli.mjs'/);
  assert.match(shim, /\$MyInvocation.ExpectingInput/);
  assert.doesNotMatch(shim, /Set-ExecutionPolicy|\$PROFILE/);
});

test("real Windows shells preserve multilingual bodies through CLI -> HTTP", { skip: process.platform !== "win32", timeout: 60000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tagora unicode 'test-"));
  const received: { url?: string; body: any }[] = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push({ url: req.url, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "test-id", seq: 1, threadChannelId: "thread-id", action: { type: "agent:create" } }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const shim = path.join(dir, "open-tag.ps1");
    await writeFile(shim, powerShellWrapper([process.execPath, path.join(root, "node_modules/tsx/dist/cli.mjs"), path.join(root, "src/cli/index.ts")]));
    const env = { ...process.env, OPEN_TAG_SERVER_URL: `http://127.0.0.1:${(server.address() as any).port}`, OPEN_TAG_AGENT_TOKEN: "test-only", OPEN_TAG_AGENT_ID: "test-agent", OPEN_TAG_TURN_FILE: "", OPEN_TAG_LOG_DIR: dir };
    const shells = [path.join(process.env.SystemRoot!, "System32/WindowsPowerShell/v1.0/powershell.exe"), path.join(process.env.ProgramFiles!, "PowerShell/7/pwsh.exe")].filter(existsSync);
    assert.ok(shells.length);
    for (const shell of shells) {
      for (const [args, url, body, field] of [
        ["message send --target '#unicode' --reply-to test", "/agent-api/message/send", unicode, "content"],
        ["thread reply --parent test", "/agent-api/thread/reply", unicode, "content"],
        ["action prepare --target '#unicode'", "/agent-api/action/prepare", JSON.stringify({ type: "agent:create", description: unicode }), "action"],
      ]) {
        const result = await run(shell!, `$env:Path = ${quote(dir)} + ';' + $env:Path; $OutputEncoding = [Text.Encoding]::ASCII; ${quote(body!)} | open-tag ${args}`, env);
        assert.equal(result.code, 0, result.err);
        const request = received.pop()!;
        assert.equal(request.url, url);
        assert.deepEqual(request.body[field!], field === "action" ? JSON.parse(body!) : unicode);
      }
      const file = path.join(dir, "body.txt");
      await writeFile(file, unicode);
      const result = await run(shell!, `& ${quote(shim)} message send --target '#unicode' --body-file ${quote(file)}`, env);
      assert.equal(result.code, 0, result.err);
      assert.equal(received.pop()!.body.content, unicode);
      const before = received.length;
      const invalid = await run(shell!, `& ${quote(shim)} message send --target '#unicode' --send-draft --body-file ${quote(file)}`, env);
      assert.notEqual(invalid.code, 0);
      assert.equal(received.length, before);
    }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
