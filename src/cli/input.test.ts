import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readBody } from "./input.js";

const text = "中文回复\n日本語：こんにちは\n한국어 안녕하세요\nEmoji: 🧪🚀 café é";
test("UTF-8 survives every byte boundary, including CJK and emoji", async () => {
  const bytes = Buffer.from(text);
  assert.equal(await readBody(undefined, Readable.from([...bytes].map(b => Buffer.from([b])))), text);
});
test("rejects malformed UTF-8 instead of silently corrupting the message", async () => {
  await assert.rejects(readBody(undefined, Readable.from([Buffer.from([0xe4, 0xbd])])), /must be UTF-8/);
});
test("UTF-8 body files bypass stdin and accept a BOM", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tagora-input-"));
  try {
    const file = path.join(dir, "日本語.txt");
    await writeFile(file, "\ufeff" + text);
    assert.equal(await readBody(file, Readable.from(["wrong input"])), text);
    await assert.rejects(readBody(path.join(dir, "missing")), /ENOENT/);
    await writeFile(file, Buffer.from([0xff, 0xfe, 0x61, 0]));
    await assert.rejects(readBody(file), /must be UTF-8/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
