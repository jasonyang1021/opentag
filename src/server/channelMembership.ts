import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";

/** Leaving a container also unfollows its threads; never delete conversation history. */
export async function removeHumanFromChannel(serverId: string, channelId: string, userId: string): Promise<string[]> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string }>(sql`
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM channels WHERE id = ${channelId} AND server_id = ${serverId}
        UNION
        SELECT c.id FROM channels c
        JOIN messages m ON m.id = c.parent_message_id
        JOIN descendants d ON d.id = m.channel_id
        WHERE c.server_id = ${serverId} AND c.type = 'thread'
      ) SELECT id FROM descendants
    `);
    const ids = rows.map((r) => r.id);
    if (ids.length) await tx.delete(schema.channelMembers).where(and(
      inArray(schema.channelMembers.channelId, ids), eq(schema.channelMembers.memberType, "user"), eq(schema.channelMembers.memberId, userId),
    ));
    return ids;
  });
}
