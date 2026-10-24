import { isUuid } from "./util.js";
/** A membership mutation must identify exactly one human or agent. */
export function channelMemberTarget(body: unknown): { type: "user" | "agent"; id: string } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if ((b.userId !== undefined) === (b.agentId !== undefined)) return null;
  const id = b.userId ?? b.agentId;
  if (typeof id !== "string" || !isUuid(id)) return null;
  return { type: b.userId !== undefined ? "user" : "agent", id };
}
