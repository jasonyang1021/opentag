import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { nextSeq } from "./realtime.js";
import { canWelcome, ONBOARDING_KIND, onboardingGuidance, welcomeText } from "./onboardingPolicy.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Called only inside invite acceptance, after winning the membership insert.
 * Seed a platform-authored welcome on the configured agent's behalf without claiming
 * runtime activity, creating a reply grant, or waking other agents. All rows commit together.
 */
export async function seedMemberWelcome(tx: Transaction, serverId: string, userId: string) {
  const [server] = await tx.select().from(schema.servers).where(eq(schema.servers.id, serverId));
  if (!server?.onboardingAgentId) return null;
  const [agent] = await tx.select().from(schema.agents).where(and(
    eq(schema.agents.serverId, serverId), eq(schema.agents.id, server.onboardingAgentId),
    isNull(schema.agents.deletedAt),
  ));
  if (!agent || agent.creatorType === "system" || !canWelcome(agent.scopes)) return null;
  // Also suppress re-welcoming a member who leaves and later rejoins this workspace.
  const [previous] = await tx.select({ id: schema.messages.id }).from(schema.messages).where(and(
    eq(schema.messages.serverId, serverId),
    sql`${schema.messages.actionMetadata} @> ${JSON.stringify({ kind: ONBOARDING_KIND, userId })}::jsonb`,
  )).limit(1);
  if (previous) return null;
  const name = "dm:" + [agent.id, userId].sort().join(":");
  const [created] = await tx.insert(schema.channels).values({ serverId, name, type: "dm" }).onConflictDoNothing().returning();
  const channel = created ?? (await tx.select().from(schema.channels).where(and(
    eq(schema.channels.serverId, serverId), eq(schema.channels.name, name), eq(schema.channels.type, "dm"),
  )))[0];
  if (!channel || channel.deletedAt) return null;
  await tx.insert(schema.channelMembers).values([
    { channelId: channel.id, memberType: "user", memberId: userId },
    { channelId: channel.id, memberType: "agent", memberId: agent.id },
  ]).onConflictDoNothing();
  const content = welcomeText(agent.displayName || agent.name);
  const [message] = await tx.insert(schema.messages).values({
    serverId, channelId: channel.id, seq: await nextSeq(serverId),
    senderType: "agent", senderId: agent.id, senderName: agent.name,
    messageType: "chat", content, searchText: content,
    actionMetadata: { kind: ONBOARDING_KIND, userId, agentId: agent.id, source: "platform" },
  }).returning();
  await tx.update(schema.channels).set({ lastMessageAt: new Date() }).where(eq(schema.channels.id, channel.id));
  return message ?? null;
}

/** The original language answer stays in durable DM history, not process memory.
 * Only expose this context to its welcome agent while it and the human are still members.
 */
export async function memberOnboardingContext(serverId: string, channelId: string, agentId: string): Promise<string> {
  const [channel] = await db.select().from(schema.channels).where(and(
    eq(schema.channels.id, channelId), eq(schema.channels.serverId, serverId),
    eq(schema.channels.type, "dm"), isNull(schema.channels.deletedAt),
  ));
  if (!channel) return "";
  const members = await db.select().from(schema.channelMembers).where(eq(schema.channelMembers.channelId, channelId));
  const human = members.find((member) => member.memberType === "user");
  if (members.length !== 2 || !human || !members.some((member) => member.memberType === "agent" && member.memberId === agentId)) return "";
  const [membership] = await db.select().from(schema.serverMembers).where(and(
    eq(schema.serverMembers.serverId, serverId), eq(schema.serverMembers.userId, human.memberId),
  ));
  if (!membership) return "";
  const [welcome] = await db.select().from(schema.messages).where(and(
    eq(schema.messages.serverId, serverId), eq(schema.messages.channelId, channelId),
    eq(schema.messages.senderId, agentId), eq(schema.messages.senderType, "agent"),
    sql`${schema.messages.actionMetadata} @> ${JSON.stringify({ kind: ONBOARDING_KIND, userId: human.memberId, agentId, source: "platform" })}::jsonb`,
  )).orderBy(asc(schema.messages.seq)).limit(1);
  if (!welcome) return "";
  const [firstReply] = await db.select({ content: schema.messages.content }).from(schema.messages).where(and(
    eq(schema.messages.serverId, serverId), eq(schema.messages.channelId, channelId),
    eq(schema.messages.senderType, "user"), eq(schema.messages.senderId, human.memberId),
    gt(schema.messages.seq, welcome.seq),
  )).orderBy(asc(schema.messages.seq)).limit(1);
  return onboardingGuidance(firstReply?.content ?? null);
}
