import test from "node:test";
import assert from "node:assert/strict";
import i18n from "../web/src/i18n.ts";
import { assertUploadSize, uploadError } from "../web/src/lib/uploadErrors.ts";
import { MAX_UPLOAD_BYTES } from "../src/uploadLimits.ts";

test("browser rejects oversize before upload but permits exact limit", () => {
  assert.doesNotThrow(() => assertUploadSize({ size: MAX_UPLOAD_BYTES }));
  assert.throws(() => assertUploadSize({ size: MAX_UPLOAD_BYTES + 1 }), /25 MB/);
});
test("proxy 413, auth, network and malformed success have actionable bilingual messages", async () => {
  for (const language of ["en", "zh"]) {
    await i18n.changeLanguage(language);
    assert.match(uploadError(413).message, /25 MB/);
    assert.equal(uploadError(413).message, uploadError(400, { error: "upload_too_large" }).message);
    assert.notEqual(uploadError(401).message, uploadError(403).message);
    assert.notEqual(uploadError(0).message, uploadError(500).message);
    assert.match(uploadError(413, { error: "upload_too_many_files" }).message, /10/);
    assert.equal(uploadError(200).message, uploadError(500).message);
  }
  await i18n.changeLanguage("en");
});
