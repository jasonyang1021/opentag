import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";

/** Decode after collecting bytes so UTF-8 characters split across chunks stay intact. */
export async function readBody(bodyFile?: string, input: Readable & { isTTY?: boolean } = process.stdin): Promise<string> {
  let bytes: Buffer;
  if (bodyFile !== undefined) {
    bytes = await readFile(bodyFile);
  } else {
    if (input.isTTY) return "";
    const chunks: Buffer[] = [];
    for await (const chunk of input) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    bytes = Buffer.concat(chunks);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Message input must be UTF-8. Use --body-file with a UTF-8 file; do not pipe through a legacy code page.");
  }
}
