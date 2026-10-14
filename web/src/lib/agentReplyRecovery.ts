import type { Msg } from "../store.tsx";
import { applyAgentReplyPreview, absorbPersistedAgentMessagePreview, dropAgentReplyPreviewsForMessage, mergePersistedAgentMessageUpdate, type AgentReplyEvent } from "./agentReplyPreview";

export type RecoveryEvent = { type: string; channelId?: string; message?: Msg; [key: string]: any };
export interface MessageLoad { channelId: string; events: RecoveryEvent[] }

/** Overlay the active snapshot and replay events that arrived while history was loading.
 * Snapshot/live Activity overlap is deduplicated; durable terminal messages win over previews.
 */
export function recoverAgentReplyPage(channelId: string, messages: Msg[], snapshots: AgentReplyEvent[], events: RecoveryEvent[]): Msg[] {
  let result = messages;
  for (const e of snapshots) if (e.channelId === channelId) result = applyAgentReplyPreview(result, e);
  for (const e of events) {
    if (e.type === "agent:reply" && e.channelId === channelId) result = applyAgentReplyPreview(result, e as AgentReplyEvent);
    else if (e.message?.channelId === channelId) {
      if (e.type === "message:updated") result = mergePersistedAgentMessageUpdate(result, e.message);
      else if (e.type === "message") {
        const absorbed = absorbPersistedAgentMessagePreview(result, e.message);
        if (absorbed.consumed) result = absorbed.messages;
        else {
          result = dropAgentReplyPreviewsForMessage(result, e.message);
          const exists = result.some((m) => m.id === e.message!.id);
          result = exists ? result.map((m) => m.id === e.message!.id ? { ...m, ...e.message } : m) : [...result, e.message];
        }
      }
    }
  }
  return result;
}
