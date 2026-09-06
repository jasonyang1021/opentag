import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { canUserReadChannel } from "./channelAccess.js";

// Keep attachment ownership on its actual message channel. Aggregation never moves
// files between channels or weakens the download endpoint's independent access check.
export async function listChannelFiles(serverId: string, channelId: string, userId: string) {
  if (!await canUserReadChannel(serverId, channelId, userId)) return null;
  const threads = await db.select({ id: schema.channels.id, parentMessageId: schema.channels.parentMessageId })
    .from(schema.channels).innerJoin(schema.messages, eq(schema.channels.parentMessageId, schema.messages.id))
    .where(and(eq(schema.channels.serverId, serverId), eq(schema.messages.serverId, serverId),
      eq(schema.messages.channelId, channelId), eq(schema.channels.type, "thread"), isNull(schema.channels.deletedAt)));
  const readable = [];
  for (const thread of threads) if (await canUserReadChannel(serverId, thread.id, userId)) readable.push(thread);
  const parents = new Map(readable.map((thread) => [thread.id, thread.parentMessageId]));
  const rows = await db.select().from(schema.attachments).where(and(
    eq(schema.attachments.serverId, serverId),
    inArray(schema.attachments.channelId, [channelId, ...readable.map((thread) => thread.id)]),
    isNotNull(schema.attachments.messageId),
  )).orderBy(desc(schema.attachments.createdAt)).limit(100);
  const agentIds = rows.filter((a) => a.uploaderType === "agent" && a.uploaderId).map((a) => a.uploaderId!);
  const userIds = rows.filter((a) => a.uploaderType === "user" && a.uploaderId).map((a) => a.uploaderId!);
  const agents = agentIds.length ? await db.select().from(schema.agents).where(and(eq(schema.agents.serverId, serverId), inArray(schema.agents.id, agentIds))) : [];
  const users = userIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, userIds)) : [];
  return rows.map((a) => {
    const uploader = a.uploaderType === "agent" ? agents.find((u) => u.id === a.uploaderId) : users.find((u) => u.id === a.uploaderId);
    return { id: a.id, messageId: a.messageId, channelId: a.channelId, filename: a.filename,
      mimeType: a.mimeType, sizeBytes: a.sizeBytes, createdAt: a.createdAt,
      uploader: { type: a.uploaderType, id: a.uploaderId, name: uploader?.name ?? null, displayName: uploader?.displayName ?? null },
      source: { type: parents.has(a.channelId!) ? "thread" : "channel", channelId, parentMessageId: parents.get(a.channelId!) ?? null } };
  });
}
