import type { AgentActivityItem } from "./agentActivity.js";

interface Reply {
  type: "agent:reply";
  agentId: string;
  channelId: string;
  streamId: string;
  name?: string;
  op: string;
  entries?: AgentActivityItem[];
}
type Run = { serverId: string; event: Reply; touched: number; ended: boolean };
const itemKey = (e: AgentActivityItem) => JSON.stringify([e.timestamp, e.kind, e.activity ?? null, e.detail ?? null, e.text ?? null, e.toolName ?? null, e.toolInput ?? null]);

/** Single-process recovery projection, not durable messages. Match the Activity log's tail cap.
 * Retain terminal tombstones to reject late activity; bound orphaned runs after lost disconnects.
 * Read only after the normal channel authorization gate. No daemon protocol changes required.
 */
export class LiveAgentReplies {
  private runs = new Map<string, Run>();
  record(serverId: string, event: any, now = Date.now()): void {
    this.prune(now);
    if (event?.type === "message" && event.message?.agentActivityStreamId) {
      const m = event.message;
      const run = this.runs.get(JSON.stringify([serverId, m.channelId, m.senderId, m.agentActivityStreamId]));
      if (run) {
        const owned = new Set((m.agentActivity ?? []).map(itemKey));
        // Keep events arriving concurrently after the message claimed its Activity rows.
        run.event = { ...run.event, entries: run.event.entries?.filter((e) => !owned.has(itemKey(e))) };
      }
      return;
    }
    if (event?.type === "agent" && (event.activity === "offline" || event.status === "inactive")) {
      for (const run of this.runs.values()) if (run.serverId === serverId && run.event.agentId === event.id) run.ended = true;
      return;
    }
    if (event?.type !== "agent:reply" || !event.agentId || !event.channelId || !event.streamId || event.op === "delta") return;
    const key = JSON.stringify([serverId, event.channelId, event.agentId, event.streamId]);
    const prev = this.runs.get(key);
    if (prev?.ended) return;
    const ended = event.op === "done" || event.op === "error";
    if (!ended && event.op !== "start" && event.op !== "activity") return;
    if (!prev && !ended) {
      for (const run of this.runs.values()) {
        if (run.serverId === serverId && run.event.channelId === event.channelId && run.event.agentId === event.agentId) run.ended = true;
      }
    }
    this.runs.set(key, { serverId, touched: now, ended, event: {
      type: "agent:reply", op: "start", agentId: event.agentId, channelId: event.channelId,
      streamId: event.streamId, name: event.name ?? prev?.event.name,
      entries: ended ? [] : [...(prev?.event.entries ?? []), ...(event.entries ?? [])].slice(-500),
    } });
    while (this.runs.size > 1000) this.runs.delete(this.runs.keys().next().value!);
  }
  snapshot(serverId: string, channelId: string, now = Date.now()): Reply[] {
    this.prune(now);
    return [...this.runs.values()].filter((r) => !r.ended && r.serverId === serverId && r.event.channelId === channelId)
      .map((r) => ({ ...r.event, entries: [...(r.event.entries ?? [])] }));
  }
  private prune(now: number): void {
    for (const [key, run] of this.runs) if (now - run.touched > 24 * 60 * 60 * 1000) this.runs.delete(key);
  }
}
export const liveAgentReplies = new LiveAgentReplies();
