import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { MAX_UPLOAD_BYTES } from "../src/uploadLimits.ts";

test("real HTTP multipart uploads enforce 25 MiB inclusively and clean rejected objects", { timeout: 30000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "opentag-upload-limit-test-"));
  process.env.OPEN_TAG_HOME = dir;
  process.env.OPEN_TAG_STORAGE = "local";
  const { parseUpload } = await import("../src/server/attachments.ts");
  const { deleteObject } = await import("../src/server/storage.ts");
  const { UploadLimitError } = await import("../src/server/uploadError.ts");
  const server = http.createServer(async (req, res) => {
    try {
      const result = await parseUpload(req);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(error instanceof UploadLimitError ? 413 : 500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: error instanceof UploadLimitError ? error.code : "internal" }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
  const upload = (sizes: number[]) => {
    const body = new FormData();
    body.append("channelId", "test");
    sizes.forEach((size, index) => body.append("files", new Blob([Buffer.alloc(size, 120)], { type: "image/png" }), `test-${index}.png`));
    return fetch(url, { method: "POST", body });
  };
  const empty = async () => assert.deepEqual(await readdir(path.join(dir, "uploads")), []);
  try {
    await t.test("25 MiB succeeds without truncation", async () => {
      const response = await upload([MAX_UPLOAD_BYTES]);
      assert.equal(response.status, 200);
      const body = await response.json() as any;
      assert.equal(body.files[0].size, MAX_UPLOAD_BYTES);
      await deleteObject(body.files[0].storageKey);
      await empty();
    });
    await t.test("25 MiB plus one byte returns 413 and removes every part", async () => {
      const response = await upload([30, MAX_UPLOAD_BYTES + 1, 40]);
      assert.equal(response.status, 413);
      assert.equal((await response.json() as any).error, "upload_too_large");
      await empty();
    });
    await t.test("larger uploads never return a truncated success", async () => {
      const response = await upload([MAX_UPLOAD_BYTES + 1024 * 1024]);
      assert.equal(response.status, 413);
      await response.text(); await empty();
    });
    await t.test("excess file count rejects the whole request", async () => {
      const response = await upload(Array(11).fill(12));
      assert.equal(response.status, 413);
      assert.equal((await response.json() as any).error, "upload_too_many_files");
      await empty();
    });
    await t.test("malformed multipart removes partial files without hanging", async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=broken" },
        body: '--broken\r\nContent-Disposition: form-data; name="files"; filename="partial.png"\r\nContent-Type: image/png\r\n\r\nunfinished',
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(response.status, 500);
      await response.text(); await empty();
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
