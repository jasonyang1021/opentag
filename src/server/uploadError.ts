import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES } from "../uploadLimits.js";

export class UploadLimitError extends Error {
  readonly status = 413;
  readonly maxBytes = MAX_UPLOAD_BYTES;
  readonly maxFiles = MAX_UPLOAD_FILES;
  constructor(readonly code: "upload_too_large" | "upload_too_many_files") {
    super(code);
  }
}
