export interface NoticeMessage {
  id: string; channelId: string; senderType: string; senderId?: string | null;
  threadId?: string | null; taskStatus?: string | null; taskAssigneeType?: string | null;
  taskAssigneeId?: string | null; mentions?: { type?: string; id?: string }[];
}
export function messageNoticeKind(message: NoticeMessage, userId: string, ownDm: boolean) {
  if (message.senderType === "system" || (message.senderType === "user" && message.senderId === userId)) return null;
  if (message.mentions?.some((m) => m.type === "user" && m.id === userId)) return "mention";
  return ownDm ? "dm" : null;
}
export function taskNoticeKind(task: NoticeMessage, userId: string, change?: { actorType?: string; actorId?: string }, previousStatus?: string | null) {
  if (!change || (change.actorType === "user" && change.actorId === userId) || previousStatus === task.taskStatus) return null;
  const mine = (task.senderType === "user" && task.senderId === userId) || (task.taskAssigneeType === "user" && task.taskAssigneeId === userId);
  return mine && (task.taskStatus === "in_review" || task.taskStatus === "done") ? task.taskStatus : null;
}
export function notificationPath(slug: string, message: NoticeMessage) {
  return `/s/${encodeURIComponent(slug)}/channel/${encodeURIComponent(message.channelId)}?msg=${encodeURIComponent(message.id)}`;
}
export function viewingNotice(pathname: string, search: string, slug: string, message: NoticeMessage, focused: boolean) {
  if (!focused) return false;
  const root = `/s/${encodeURIComponent(slug)}/channel/`;
  const threadParent = new URLSearchParams(search).get("thread");
  return pathname === root + encodeURIComponent(message.channelId) || (pathname.startsWith(root) && threadParent === message.id);
}
