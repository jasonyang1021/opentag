// Run against an isolated test DB: node --import tsx --test test/channelDetail.integration.ts
// Requires the migrated local PostgreSQL/Redis stack, never a production DATABASE_URL.
import "../src/env.js";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db, schema, sql } from "../src/db/index.js";
import { handleChannels } from "../src/server/routes-api/channels.js";
import { redis, pub, sub } from "../src/redis.js";

after(async () => { redis.disconnect(); pub.disconnect(); sub.disconnect(); await sql.end(); });

test("channel detail resolves nested threads and preserves inherited visibility", async () => {
  const suffix = randomUUID();
  const userIds: string[] = [], serverIds: string[] = [], channelIds: string[] = [];
  let seq = 0;
  try {
    const users = await db.insert(schema.users).values(["owner", "outsider"].map((name) => ({
      name: `${name}-${suffix}`, displayName: name, email: `${name}-${suffix}@example.test`,
    }))).returning();
    userIds.push(...users.map((u) => u.id));
    const [owner, outsider] = userIds as [string, string];
    const servers = await db.insert(schema.servers).values(["a", "b"].map((name) => ({ name, slug: `${name}-${suffix}`, ownerId: owner }))).returning();
    serverIds.push(...servers.map((s) => s.id));
    const [tenant, foreign] = serverIds as [string, string];
    await db.insert(schema.serverMembers).values(serverIds.flatMap((serverId) => userIds.map((userId) => ({ serverId, userId, role: userId === owner ? "owner" : "member" }))));
    const channel = async (serverId: string, type: string, parentMessageId?: string) => {
      const [row] = await db.insert(schema.channels).values({ serverId, type, name: `${type}-${randomUUID()}`, parentMessageId }).returning();
      channelIds.push(row!.id); return row!.id;
    };
    const child = async (root: string) => {
      const [message] = await db.insert(schema.messages).values({ serverId: tenant, channelId: root, senderType: "user", senderId: owner, senderName: "owner", content: "task", seq: ++seq }).returning();
      return channel(tenant, "thread", message!.id);
    };
    const request = async (id: string, userId = owner, serverId = tenant) => {
      let status = 0, body: any;
      const res = { writeHead: (s: number) => { status = s; }, end: (value: string) => { body = JSON.parse(value); } } as unknown as ServerResponse;
      const p = `/api/channels/${id}/detail`;
      assert.equal(await handleChannels({ req: {} as IncomingMessage, res, url: new URL(p, "http://localhost"), method: "GET", p, userId, serverId }), true);
      return { status, body };
    };
    const pub = await channel(tenant, "channel");
    const privateRoot = await channel(tenant, "private");
    await db.insert(schema.channelMembers).values({ channelId: privateRoot, memberType: "user", memberId: owner });
    const nested = await child(await child(privateRoot));
    assert.equal((await request(pub, outsider)).status, 200);
    const detail = await request(nested);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.id, nested);
    assert.equal(detail.body.type, "thread");
    assert.equal(detail.body.audit, false);
    assert.equal((await request(nested, outsider)).status, 404);
    assert.equal((await request(nested, owner, foreign)).status, 404);
    assert.equal((await request(randomUUID())).status, 404);
    assert.equal((await request("invalid")).status, 404);
    await db.update(schema.channels).set({ deletedAt: new Date() }).where(eq(schema.channels.id, privateRoot));
    assert.equal((await request(nested)).status, 404);
  } finally {
    if (channelIds.length) {
      await db.delete(schema.channelMembers).where(inArray(schema.channelMembers.channelId, channelIds));
      await db.delete(schema.messages).where(inArray(schema.messages.channelId, channelIds));
      await db.delete(schema.channels).where(inArray(schema.channels.id, channelIds));
    }
    if (serverIds.length) {
      await db.delete(schema.serverMembers).where(inArray(schema.serverMembers.serverId, serverIds));
      await db.delete(schema.servers).where(inArray(schema.servers.id, serverIds));
    }
    if (userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, userIds));
  }
});
