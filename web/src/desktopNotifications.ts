import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useStore } from "./store.tsx";
import { messageNoticeKind, notificationPath, taskNoticeKind, viewingNotice } from "./lib/desktopNotificationPolicy";

export const NOTIFICATION_SETTINGS_EVENT = "tagora:notification-settings";
export const desktopKey = (userId: string, serverId: string) => `tagora.desktop.${userId}.${serverId}`;
export function desktopEnabled(key: string) { try { return localStorage.getItem(key) === "true"; } catch { return false; } }
export function setDesktopEnabled(key: string, enabled: boolean) {
  localStorage.setItem(key, String(enabled));
  window.dispatchEvent(new Event(NOTIFICATION_SETTINGS_EVENT));
}
export function desktopPermission(): NotificationPermission | "unsupported" | "insecure" {
  if (!window.isSecureContext) return "insecure";
  return "Notification" in window ? Notification.permission : "unsupported";
}
export function showDesktop(title: string, body: string, tag: string, click: () => void): Notification {
  const notification = new Notification(title, { body, tag });
  notification.onclick = () => { notification.close(); window.focus(); click(); };
  return notification;
}

// Only already-authorized live events are eligible. No polling of message contents,
// no push subscriptions, no background worker, and no private previews on the lock screen.
export function useDesktopNotifications() {
  const { api, serverId, slug, me, dms, onEvent } = useStore();
  const loc = useLocation(), navigate = useNavigate();
  const { t } = useTranslation();
  const current = useRef({ dms, loc, t }); current.current = { dms, loc, t };
  useEffect(() => { window.dispatchEvent(new Event("tagora:view-change")); }, [loc.pathname, loc.search]);
  useEffect(() => {
    if (!me || !serverId) return;
    let disposed = false, muted = true, request = 0;
    const key = desktopKey(me.id, serverId);
    const presenceKey = `${key}.view`, tabId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const publishView = () => {
      try {
        if (document.visibilityState === "visible" && document.hasFocus()) {
          const { loc } = current.current;
          localStorage.setItem(presenceKey, JSON.stringify({ tabId, pathname: loc.pathname, search: loc.search,
            thread: document.querySelector<HTMLElement>("[data-notification-channel]")?.dataset.notificationChannel, time: Date.now() }));
        } else if (JSON.parse(localStorage.getItem(presenceKey) || "null")?.tabId === tabId) localStorage.removeItem(presenceKey);
      } catch { /* Storage can be unavailable in private browsing. */ }
    };
    publishView();
    const presenceTimer = window.setInterval(publishView, 3000);
    window.addEventListener("focus", publishView); window.addEventListener("blur", publishView);
    window.addEventListener("tagora:view-change", publishView); document.addEventListener("visibilitychange", publishView);
    const seen = new Set<string>(), statuses = new Map<string, string>();
    const shown = new Set<Notification>();
    const refresh = async () => {
      const version = ++request;
      muted = true;
      try { const settings = await api("GET", `/api/servers/${serverId}/notification-settings`); if (!disposed && version === request) muted = !!settings.serverPushMuted; }
      catch { if (!disposed && version === request) muted = true; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 60000);
    const storageChanged = (event: StorageEvent) => { if (event.key === key || event.key === `${key}.mute`) void refresh(); };
    window.addEventListener(NOTIFICATION_SETTINGS_EVENT, refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storageChanged);
    const off = onEvent(async (event) => {
      const message = event.type === "message" && event.live ? event.message : event.type === "task" ? event.task : null;
      if (!message?.id || !message.channelId) return;
      const { dms, t } = current.current;
      const knownDm = dms.find((d) => d.id === message.channelId);
      let ownDm = !!knownDm && !knownDm.audit;
      if (!knownDm && event.type === "message" && message.channelType === "dm") {
        // A first DM may arrive before dm:new has finished refreshing the sidebar.
        try { const detail = await api("GET", `/api/channels/${encodeURIComponent(message.channelId)}/detail`); ownDm = detail.type === "dm" && !detail.audit; }
        catch { return; }
        if (disposed) return;
      }
      const previous = statuses.get(message.id);
      if (message.taskStatus) statuses.set(message.id, message.taskStatus);
      if (statuses.size > 1000) statuses.delete(statuses.keys().next().value!);
      const kind = event.type === "task" ? taskNoticeKind(message, me.id, event.statusChange, previous)
        : messageNoticeKind(message, me.id, ownDm);
      if (!kind) return;
      const id = `${event.type}:${message.id}:${kind}:${event.type === "task" ? message.updatedAt || "" : ""}`;
      if (seen.has(id)) return;
      seen.add(id); if (seen.size > 1000) seen.delete(seen.values().next().value!);
      const visible = () => {
        publishView();
        if (document.visibilityState === "visible" && document.hasFocus()) {
          const openThread = document.querySelector<HTMLElement>("[data-notification-channel]")?.dataset.notificationChannel;
          if (openThread === message.channelId || viewingNotice(current.current.loc.pathname, current.current.loc.search, slug, message, true)) return true;
        }
        try {
          const other = JSON.parse(localStorage.getItem(presenceKey) || "null");
          return !!other && Date.now() - other.time < 9000 && (other.thread === message.channelId || viewingNotice(other.pathname, other.search, slug, message, true));
        } catch { return false; }
      };
      if (visible() || !desktopEnabled(key) || desktopPermission() !== "granted") return;
      const deliver = async () => {
        if (disposed) return;
        await refresh(); // Re-check account-level mute immediately before publication.
        if (disposed || muted || visible() || !desktopEnabled(key) || desktopPermission() !== "granted") return;
        try {
          // A bounded shared ledger plus a Web Lock makes simultaneous tabs atomic.
          const ledgerKey = `${key}.recent`;
          let recent: string[] = [];
          try { const stored = JSON.parse(localStorage.getItem(ledgerKey) || "[]"); if (Array.isArray(stored)) recent = stored.filter((id) => typeof id === "string").slice(-100); } catch { /* Replace a malformed ledger. */ }
          if (recent.includes(id)) return;
          const notice = showDesktop("Tagora", t(`desktopNotifications.${kind}`), `${key}:${id}`, () => { if (!disposed) navigate(notificationPath(slug, message)); });
          shown.add(notice); notice.onclose = () => shown.delete(notice);
          localStorage.setItem(ledgerKey, JSON.stringify([...recent, id].slice(-100)));
        } catch { /* Unsupported constructors / blocked storage must not break chat. */ }
      };
      if (navigator.locks) void navigator.locks.request(key, deliver).catch(() => {});
      else deliver();
    });
    return () => {
      disposed = true; off(); clearInterval(timer); shown.forEach((n) => n.close());
      clearInterval(presenceTimer);
      window.removeEventListener("focus", publishView); window.removeEventListener("blur", publishView);
      window.removeEventListener("tagora:view-change", publishView); document.removeEventListener("visibilitychange", publishView);
      try { if (JSON.parse(localStorage.getItem(presenceKey) || "null")?.tabId === tabId) localStorage.removeItem(presenceKey); } catch { /* */ }
      window.removeEventListener(NOTIFICATION_SETTINGS_EVENT, refresh);
      window.removeEventListener("focus", refresh); window.removeEventListener("storage", storageChanged);
    };
  }, [serverId, me?.id, slug]);
}
