import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "./store.tsx";
import { desktopEnabled, desktopKey, desktopPermission, NOTIFICATION_SETTINGS_EVENT, setDesktopEnabled, showDesktop } from "./desktopNotifications";

export function NotificationSettings() {
  const { api, serverId, me } = useStore();
  const { t } = useTranslation();
  const key = desktopKey(me?.id || "", serverId);
  const [permission, setPermission] = useState(desktopPermission);
  const [enabled, setEnabled] = useState(() => desktopEnabled(key));
  const [muted, setMuted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    let cancelled = false;
    api("GET", `/api/servers/${serverId}/notification-settings`).then((r: any) => { if (!cancelled) setMuted(!!r.serverPushMuted); })
      .catch(() => { if (!cancelled) setFeedback("error"); });
    const sync = () => { setPermission(desktopPermission()); setEnabled(desktopEnabled(key)); };
    sync(); window.addEventListener("focus", sync); window.addEventListener("storage", sync);
    return () => { cancelled = true; window.removeEventListener("focus", sync); window.removeEventListener("storage", sync); };
  }, [serverId, key]);
  const toggleDesktop = async () => {
    setBusy(true); setFeedback("");
    try {
      if (enabled) { setDesktopEnabled(key, false); setEnabled(false); return; }
      const next = await Notification.requestPermission(); setPermission(next);
      if (next === "granted") { setDesktopEnabled(key, true); setEnabled(true); }
    } catch { setFeedback("error"); }
    finally { setBusy(false); }
  };
  const toggleMute = async () => {
    setBusy(true); setFeedback("");
    try {
      const r = await api("PATCH", `/api/servers/${serverId}/notification-settings`, { serverPushMuted: !muted });
      setMuted(!!r.serverPushMuted);
      try { localStorage.setItem(`${key}.mute`, String(Date.now())); } catch { /* Server preference is already saved. */ }
      window.dispatchEvent(new Event(NOTIFICATION_SETTINGS_EVENT));
    } catch { setFeedback("error"); }
    finally { setBusy(false); }
  };
  const test = () => {
    try {
      const notice = showDesktop("Tagora", t("desktopNotifications.testBody"), "tagora-test", () => {});
      notice.onerror = () => setFeedback("error");
      setFeedback("testSent");
    } catch { setFeedback("error"); }
  };
  return <div className="setform">
    <div className="toggle-row">
      <div className="toggle-text"><div className="toggle-title">{t("desktopNotifications.title")}</div><div className="toggle-sub">{t("desktopNotifications.description")}</div></div>
      <button disabled={busy || (!enabled && permission !== "default" && permission !== "granted")} onClick={toggleDesktop}>{t(enabled ? "desktopNotifications.disable" : "desktopNotifications.enable")}</button>
    </div>
    <p className="meta">{t(`desktopNotifications.${permission}`)}</p>
    <p className="meta">{t("desktopNotifications.scope")}</p>
    <div className="setrow"><button disabled={!enabled || permission !== "granted" || muted !== false || busy} onClick={test}>{t("desktopNotifications.test")}</button></div>
    <div className="toggle-row">
      <div className="toggle-text"><div className="toggle-title">{t("misc.notifMuteTitle")}</div><div className="toggle-sub">{t("misc.notifMuteDesc")}</div></div>
      <button disabled={muted === null || busy} role="switch" aria-label={t("misc.notifMuteTitle")} aria-checked={!!muted} className={"switch" + (muted ? " on" : "")} onClick={toggleMute}><span className="knob" /></button>
    </div>
    {feedback && <p role="status">{t(`desktopNotifications.${feedback}`)}</p>}
  </div>;
}
