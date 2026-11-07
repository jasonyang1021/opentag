import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fetchImageFile, imageFilename, saveImageFile } from "./lib/imageDownload";
import "./imageDownload.css";

export function ImageDownload({ src, filename }: { src: string; filename?: string }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  return <span className="image-download-actions" onClick={(e) => e.stopPropagation()}>
    <button type="button" className="image-download-button" disabled={busy} onClick={async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (inFlight.current) return;
      inFlight.current = true; setBusy(true); setFailed(false);
      try { saveImageFile(await fetchImageFile(src), imageFilename(src, filename)); }
      catch { setFailed(true); }
      finally { inFlight.current = false; setBusy(false); }
    }}><Download size={16} aria-hidden="true" />{t(busy ? "chat.downloadingImage" : "chat.downloadOriginal")}</button>
    {failed && <span role="alert" className="image-download-error">{t("chat.imageDownloadFailed")} <a href={src} target="_blank" rel="noopener noreferrer">{t("chat.openOriginal")}</a></span>}
  </span>;
}
