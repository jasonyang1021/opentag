interface MemberSocket {
  data: { uid?: string; serverId?: string };
  leave(room: string): unknown;
  emit(event: string, payload: unknown): unknown;
}
/** Evict only the removed Human's sessions, never another user/workspace. */
export async function evictHumanChannelSessions(sockets: MemberSocket[], serverId: string, userId: string, channelIds: string[]): Promise<void> {
  for (const socket of sockets) {
    if (socket.data.serverId !== serverId || socket.data.uid !== userId) continue;
    for (const id of channelIds) await socket.leave(`channel:${id}`);
    socket.emit("channel:left", { channelIds });
  }
}
