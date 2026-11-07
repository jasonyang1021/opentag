import test from "node:test";
import assert from "node:assert/strict";
import { fetchImageFile, imageFilename } from "../web/src/lib/imageDownload.ts";

test("download filenames retain originals without URL credentials or path separators", () => {
  assert.equal(imageFilename("https://site.test/picture.png?token=secret"), "picture.png");
  assert.equal(imageFilename("/api/attachments/id", "设计图.png"), "设计图.png");
  assert.equal(imageFilename("/", "../../unsafe.png"), ".._.._unsafe.png");
  assert.equal(imageFilename("https://site.test/"), "image");
});

test("image download uses authenticated same-origin fetch, no credentials for external images", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "https://site.test/chat", origin: "https://site.test" } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window"); });
  const calls: RequestInit[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    calls.push(options);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
  });
  assert.equal((await fetchImageFile("/image.png")).size, 3);
  await fetchImageFile("https://external.test/image.png");
  assert.equal(calls[0]?.credentials, "same-origin");
  assert.equal(calls[1]?.credentials, "omit");
  assert.equal(calls[1]?.referrerPolicy, "no-referrer");
  await assert.rejects(fetchImageFile("javascript:alert(1)"));
});

test("download rejects HTTP, non-image, empty and network failures instead of saving error pages", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "https://site.test/", origin: "https://site.test" } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window"); });
  const responses = [new Response("denied", { status: 403 }), new Response("login", { headers: { "content-type": "text/html" } }), new Response("", { headers: { "content-type": "image/png" } })];
  t.mock.method(globalThis, "fetch", async () => {
    if (responses.length) return responses.shift()!;
    throw new TypeError("network / CORS");
  });
  for (let i = 0; i < 4; i++) await assert.rejects(fetchImageFile("/image.png"));
});
