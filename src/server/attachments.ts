// Attachment multipart upload parser: streams via busboy into storage.saveObject (driver-agnostic: local disk or S3-compatible).
import Busboy from "busboy";
import type { IncomingMessage } from "node:http";
import { saveObject, deleteObject } from "./storage.js";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES } from "../uploadLimits.js";
import { UploadLimitError } from "./uploadError.js";
import { rasterImageType } from "./imageType.js";

export interface UploadedFile { filename: string; mimeType: string; size: number; storageKey: string }

/**
 * Normalise a client-declared MIME type before storage.
 *
 * Browsers control the Content-Type of each multipart part, so we never trust
 * it at face value. This function:
 *   - Extracts only the base type (strips "; charset=utf-8" etc. to prevent
 *     header-injection via stored parameters).
 *   - Normalises to lowercase.
 *   - Rejects malformed or injection-looking strings, falling back to
 *     "application/octet-stream".
 *
 * Note: this does NOT filter out dangerous types like text/html — that
 * responsibility belongs to safeDownloadHeaders() in routes-api/attachments.ts,
 * which enforces a safe-inline whitelist at serve time and covers both new
 * uploads and any legacy records already in the database.
 */
export function sanitizeMimeType(declared: string): string {
  // Extract the base type (before the first ";")
  const base = declared.split(";")[0]?.trim().toLowerCase() ?? "";
  // A valid MIME type is "type/subtype" where both parts are non-empty tokens.
  // RFC 2045 tokens: printable ASCII excluding specials. We use a conservative
  // subset that covers all real-world types while rejecting injection attempts.
  if (/^[a-z0-9][a-z0-9!#$&\-^_.+]*\/[a-z0-9][a-z0-9!#$&\-^_.+]*$/.test(base)) {
    return base;
  }
  return "application/octet-stream";
}

export function parseUpload(req: IncomingMessage): Promise<{ fields: Record<string, string>; files: UploadedFile[] }> {
  return new Promise((resolve, reject) => {
    let bb: ReturnType<typeof Busboy>;
    // Busboy emits limit on equality: allow one sentinel byte so exactly 25 MiB succeeds.
    try { bb = Busboy({ headers: req.headers, limits: { fileSize: MAX_UPLOAD_BYTES + 1, files: MAX_UPLOAD_FILES } }); }
    catch (e) { return reject(e); }
    const fields: Record<string, string> = {};
    const files: UploadedFile[] = [];
    const pending: Promise<void>[] = [];
    let firstError: unknown = null;
    bb.on("field", (name, val) => { fields[name] = val; });
    bb.on("file", (_name, stream, info) => {
      // Storage may await directory creation before attaching its stream listeners.
      stream.on("error", (error) => { firstError ??= error; });
      stream.on("limit", () => { firstError ??= new UploadLimitError("upload_too_large"); });
      // Each per-file task self-catches: a save that fails (especially before the stream is
      // consumed, e.g. s3Config() validation) must still drain the stream so busboy emits
      // "close", and must never surface as an unhandledRejection (which crashes the process
      // on Node ≥15). The error is remembered and surfaced once, after close.
      pending.push((async () => {
        try {
          // Capture only a bounded prefix while storage consumes the stream. Attaching
          // an extra data listener here would start flow before storage is ready.
          let prefix = Buffer.alloc(0);
          const { key, size } = await saveObject(info.filename || "file", stream, (chunk) => {
            if (prefix.length < 16) prefix = Buffer.concat([prefix, chunk.subarray(0, 16 - prefix.length)]);
          });
          const mimeType = rasterImageType(prefix) || sanitizeMimeType(info.mimeType || "application/octet-stream");
          files.push({ filename: info.filename || "file", mimeType, size, storageKey: key });
          if (size > MAX_UPLOAD_BYTES) firstError ??= new UploadLimitError("upload_too_large");
        } catch (e) {
          stream.resume(); // drain any unconsumed bytes so busboy can finish and emit "close"
          firstError ??= e;
        }
      })());
    });
    bb.on("filesLimit", () => { firstError ??= new UploadLimitError("upload_too_many_files"); });
    bb.on("close", () => {
      void (async () => {
        await Promise.all(pending);
        if (firstError) {
          const cleanup = await Promise.allSettled(files.map((file) => deleteObject(file.storageKey)));
          if (cleanup.some((r) => r.status === "rejected")) throw new Error("upload cleanup failed");
          throw firstError;
        }
        resolve({ fields, files });
      })().catch(reject);
    });
    bb.on("error", (error) => { firstError ??= error; });
    req.on("aborted", () => bb.destroy(new Error("upload aborted")));
    req.pipe(bb);
  });
}
