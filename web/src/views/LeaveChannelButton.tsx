import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";
import { useStore, type Channel } from "../store.tsx";
import { useConfirm } from "../ConfirmModal.tsx";
import { useToast } from "../toast.tsx";

/** Self-leave deliberately does not require manageChannels. Navigation follows the store event. */
export function LeaveChannelButton({ channel }: { channel: Channel }) {
  const { t } = useTranslation();
  const { leaveChannel, serverId } = useStore();
  const currentServer = useRef(serverId); currentServer.current = serverId;
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const leave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const accepted = await confirm({ title: t("chat.leaveChannel"), message: t(channel.type === "private" ? "chat.leavePrivateConfirm" : "chat.leaveConfirm", { name: channel.name }), confirmLabel: t("chat.leaveChannel"), danger: true });
      if (accepted && currentServer.current === serverId) await leaveChannel(channel.id);
    } catch { toast.error(t("chat.membershipFailed")); }
    finally { setBusy(false); }
  };
  return <button className="joinbtn" title={t("chat.leaveChannel")} disabled={busy} onClick={leave}><LogOut size={16} /><span className="joinbtn-label">{t("chat.leaveChannel")}</span></button>;
}
