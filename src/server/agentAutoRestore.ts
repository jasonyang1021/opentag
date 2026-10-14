import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { createLogger } from "../log.js";
import { startAgent } from "./core.js";
import { runAgentRestore } from "./agentRestoreRunner.js";

const log = createLogger("server:agent-restore");

export async function restoreAgentsOnMachine(
  serverId: string, machineId: string, runningIds: string[], isCurrent: () => boolean,
): Promise<string[]> {
  const candidates = await db.select({ id: schema.agents.id }).from(schema.agents).where(and(
    eq(schema.agents.serverId, serverId), eq(schema.agents.machineId, machineId),
    eq(schema.agents.autoRestore, true), isNull(schema.agents.deletedAt),
  )).orderBy(schema.agents.createdAt, schema.agents.id);
  return runAgentRestore({
    candidates: candidates.map((a) => a.id), runningIds, isCurrent,
    start: (agentId) => startAgent(serverId, agentId, { machineId, isCurrent }),
    report: (agentId, result) => {
      if (result.ok) log.info("agent restore accepted", { machineId, agentId });
      else log.warn("agent restore skipped or failed", { machineId, agentId, reason: result.reason });
    },
  });
}
