import i18n from "../i18n";
import { MAX_UPLOAD_BYTES } from "../../../src/uploadLimits";

export function assertUploadSize(file: { size: number }): void {
  if (file.size > MAX_UPLOAD_BYTES) throw uploadError(413);
}

/** Do not display raw proxy HTML or server internals as an error. */
export function uploadError(status: number, body?: { error?: string }): Error {
  const key = body?.error === "upload_too_many_files" ? "uploadTooMany"
    : status === 413 || body?.error === "upload_too_large" ? "uploadTooLarge"
    : status === 401 ? "uploadUnauthorized"
    : status === 403 ? "uploadForbidden"
    : status === 0 ? "uploadNetworkError" : "uploadFailed";
  return new Error(i18n.t(`chat.${key}`));
}
