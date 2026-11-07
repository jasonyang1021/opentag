// Identify common raster formats by signature, never by a user-controlled filename.
// This is format detection, not full image decoding; corrupt images fall back in the UI.
export function rasterImageType(bytes: Uint8Array): string | undefined {
  const b = Buffer.from(bytes);
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b.length >= 6 && ["GIF87a", "GIF89a"].includes(b.toString("ascii", 0, 6))) return "image/gif";
  if (b.length >= 16 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP"
    && ["VP8 ", "VP8L", "VP8X"].includes(b.toString("ascii", 12, 16))) return "image/webp";
  return undefined;
}
