import test from "node:test";
import assert from "node:assert/strict";
import { rasterImageType } from "../src/server/imageType.ts";

test("raster signatures identify supported agent image outputs", () => {
  for (const [hex, mime] of [
    ["89504e470d0a1a0a", "image/png"],
    ["ffd8ffe0", "image/jpeg"],
    ["474946383961", "image/gif"],
    ["52494646100000005745425056503820", "image/webp"],
  ]) assert.equal(rasterImageType(Buffer.from(hex!, "hex")), mime);
});

test("unknown, truncated, SVG, HTML and non-WebP RIFF stay unclassified", () => {
  for (const text of ["", "PNG", "GIF", "<svg></svg>", "<html></html>", "RIFF1234WAVEfmt "])
    assert.equal(rasterImageType(Buffer.from(text)), undefined);
  assert.equal(rasterImageType(Buffer.from([137, 80, 78])), undefined);
});
