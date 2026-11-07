import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageDownload } from "./ImageDownload";
import { Lightbox } from "./Lightbox";

export function MessageImage({ src, alt = "", filename }: { src: string; alt?: string; filename?: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const { t } = useTranslation();
  return <span className="message-image">
    {failed ? <span role="status">{t("chat.imagePreviewFailed")}</span> :
      <button type="button" className="msg-att-img" title={alt} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      </button>}
    <ImageDownload src={src} filename={filename} />
    {open && <Lightbox src={src} alt={alt} filename={filename} onClose={() => setOpen(false)} />}
  </span>;
}
