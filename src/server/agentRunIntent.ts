import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export type AgentRestoreContext = { machineId: string; isCurrent: () => boolean };

export async function setAgentRunIntent(serverId: string, agentId: string, enabled: boolean): Promise<boolean> {
  const rows = await db.update(schema.agents).set({ autoRestore: enabled }).where(and(
    eq(schema.agents.serverId, serverId), eq(schema.agents.id, agentId), isNull(schema.agents.deletedAt),
  )).returning({ id: schema.agents.id });
  return rows.length > 0;
}

// Called inside the lifecycle FIFO, not from a stale reconnect candidate snapshot.
export async function canRestoreAgent(serverId: string, agentId: string, context: AgentRestoreContext): Promise<boolean> {
  if (!context.isCurrent()) return false;
  const [agent] = await db.select({ status: schema.agents.status }).from(schema.agents).where(and(
    eq(schema.agents.serverId, serverId), eq(schema.agents.id, agentId),
    eq(schema.agents.machineId, context.machineId), eq(schema.agents.autoRestore, true),
    isNull(schema.agents.deletedAt),
  ));
  // Another wake/manual start may already have claimed this process since ready.
  return !!agent && context.isCurrent() && (agent.status === "inactive" || agent.status === "sleeping");
}
