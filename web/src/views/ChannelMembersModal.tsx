import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "../store.tsx";
import { Avatar, resolveAvatar } from "../Avatar.tsx";
import { useEscClose } from "../ConfirmModal.tsx";

// Channel roster: managers invite workspace Humans/Agents and can remove Agents.
export function ChannelMembersModal({ channelId, channelName, onClose }: { channelId: string; channelName: string; onClose: () => void }) {
  /* avatars: data.agents/humans come from /channels/:id/members (carry avatarUrl); resolve to signed/scheme via resolveAvatar */
  const { t } = useTranslation();
  useEscClose(onClose);
  const { api, visibleAgents: agents, humans, attachmentUrl, capabilities, serverId, onEvent } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const mounted = useRef(false);
  const avFor = (u?: string | null) => resolveAvatar(u, attachmentUrl);
  const [data, setData] = useState<{ agents: any[]; humans: any[] }>({ agents: [], humans: [] });
  useEffect(() => {
    let cancelled = false; mounted.current = true; setReady(false); setError(false);
    api("GET", `/api/channels/${channelId}/members`).then((d) => {
      if (cancelled) return;
      if (!Array.isArray(d?.agents) || !Array.isArray(d?.humans)) throw new Error("members unavailable");
      setData(d); setReady(true);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; mounted.current = false; };
  }, [channelId, serverId, revision]);
  useEffect(() => onEvent((e) => { if (e.type === "channel:members-updated" && e.channelId === channelId) setRevision((n) => n + 1); }), [channelId, serverId]);
  const inCh = new Set(data.agents.map((a) => a.id));
  const addable = agents.filter((a) => !inCh.has(a.id));
  const addableHumans = humans.filter((h) => !data.humans.some((m) => m.userId === h.userId));
  const mutate = async (method: string, body: { agentId?: string; userId?: string }) => {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const r = await api(method, `/api/channels/${channelId}/members`, body);
      if (r?.ok !== true) throw new Error("membership failed");
      if (mounted.current) setRevision((n) => n + 1);
    } catch { if (mounted.current) setError(true); }
    finally { if (mounted.current) setBusy(false); }
  };
  const add = (agentId: string) => mutate("POST", { agentId });
  const remove = (agentId: string) => mutate("DELETE", { agentId });
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3># {channelName} · {t("chat.membersCount", { count: data.agents.length + data.humans.length })}</h3>
        {error && <div role="alert">{t("chat.membershipFailed")} <button onClick={() => setRevision((n) => n + 1)}>{t("fileLibrary.refresh")}</button></div>}
        {!ready && !error && <div role="status">{t("misc.notifLoading")}</div>}
        <fieldset disabled={busy || !ready} style={{ border: 0, padding: 0, margin: 0, maxHeight: "60vh", overflowY: "auto" }}>
        <div className="sec">{t("common.agents")} <span className="cnt">{data.agents.length}</span></div>
        {data.agents.map((a) => (
          <div key={a.id} className="item"><Avatar kind="agent" seed={a.name} url={avFor(a.avatarUrl)} size={22} /><span className="grow">{a.displayName || a.name}</span><span className={"dot " + (a.activity || a.status)} />{capabilities.manageChannels && <button className="joinbtn" onClick={() => remove(a.id)}>{t("chat.remove")}</button>}</div>
        ))}
        <div className="sec">{t("common.humans")} <span className="cnt">{data.humans.length}</span></div>
        {data.humans.map((u) => (
          <div key={u.userId} className="item"><Avatar seed={u.name} url={avFor(u.avatarUrl)} size={22} /><span className="grow">{u.displayName || u.name}</span></div>
        ))}
        {capabilities.manageChannels && addable.length > 0 && <>
          <div className="sec sec-sub">{t("chat.addAgent")}</div>
          {addable.map((a) => (
            <div key={a.id} className="item ghost"><Avatar kind="agent" seed={a.name} url={avFor(a.avatarUrl)} size={22} /><span className="grow">{a.displayName || a.name}</span><button className="joinbtn" onClick={() => add(a.id)}>{t("chat.join")}</button></div>
          ))}
        </>}
        {capabilities.manageChannels && addableHumans.length > 0 && <>
          <div className="sec sec-sub">{t("chat.addHuman")}</div>
          {addableHumans.map((h) => <div key={h.userId} className="item ghost"><Avatar seed={h.name} url={avFor(h.avatarUrl)} size={22} /><span className="grow">{h.displayName || h.name}</span><button className="joinbtn" onClick={() => mutate("POST", { userId: h.userId })}>{t("chat.join")}</button></div>)}
        </>}
        </fieldset>
        <div className="acts"><button className="cancel" onClick={onClose}>{t("chat.close")}</button></div>
      </div>
    </div>
  );
}
