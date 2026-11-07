export function imageFilename(src: string, filename?: string): string {
  let name = filename;
  if (!name) {
    try { name = decodeURIComponent(new URL(src, "https://local.invalid").pathname.split("/").pop() || ""); }
    catch { /* Use a safe fallback, never include URL query credentials. */ }
  }
  return (name || "image").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 180) || "image";
}

export async function fetchImageFile(src: string): Promise<Blob> {
  const url = new URL(src, window.location.href);
  if (!["http:", "https:", "blob:"].includes(url.protocol)) throw new Error("unsupported image URL");
  const response = await fetch(url.href, {
    credentials: url.origin === window.location.origin ? "same-origin" : "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error("image download failed");
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith("image/")) throw new Error("not an image response");
  return blob;
}

export function saveImageFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  if (!("download" in link)) { URL.revokeObjectURL(url); throw new Error("download unsupported"); }
  link.href = url;
  const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[blob.type];
  link.download = /\.[a-z0-9]{2,5}$/i.test(filename) || !ext ? filename : `${filename}.${ext}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Mobile browsers can consume the URL after the click handler returns.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
