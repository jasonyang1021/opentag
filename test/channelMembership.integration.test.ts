import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";

test("channel Human invitation and self-leave respect workspace, role and thread boundaries", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /test/.test(url.pathname), "Requires an isolated local test database");
  process.env.DATABASE_URL = url.toString();
  process.env.JWT_SECRET ||= "channel-membership-test-only";
  process.env.DAEMON_BOOTSTRAP_KEY ||= "channel-membership-test-only";
  const { db, schema, sql } = await import("../src/db/index.ts");
  const { handleChannels } = await import("../src/server/routes-api/channels.ts");
  const { canUserReadChannel } = await import("../src/server/channelAccess.ts");
  const { redis, pub, sub } = await import("../src/redis.ts");
  for (const client of [redis, pub, sub]) client.disconnect(); // No Redis sequence allocation in these operations.
  const { eq, inArray } = await import("drizzle-orm");
  const owner = randomUUID(), human = randomUUID(), stranger = randomUUID();
  const server = randomUUID(), foreign = randomUUID();
  const root = randomUUID(), thread = randomUUID(), nested = randomUUID(), publicCh = randomUUID(), foreignCh = randomUUID(), dm = randomUUID();
  const parent = randomUUID(), reply = randomUUID();
  const agent = randomUUID(), foreignAgent = randomUUID(), deletedAgent = randomUUID();
  const users = [owner, human, stranger], servers = [server, foreign], channels = [root, thread, nested, publicCh, foreignCh, dm];
  const call = async (userId: string, channelId: string, action: string, method: string, body?: unknown) => {
    let status = 0, result: any;
    const req = Readable.from([JSON.stringify(body ?? {})]) as IncomingMessage;
    const res = { writeHead(code: number) { status = code; }, end(raw: string) { result = JSON.parse(raw); } } as unknown as ServerResponse;
    const p = `/api/channels/${channelId}/${action}`;
    assert.equal(await handleChannels({ req, res, url: new URL(p, "http://localhost"), method, p, serverId: server, userId }), true);
    return { status, result };
  };
  try {
    await db.insert(schema.users).values(users.map((id) => ({ id, name: `test-${id}`, displayName: "Test", email: `${id}@example.test` })));
    await db.insert(schema.servers).values(servers.map((id) => ({ id, name: "Test", slug: `test-${id}`, ownerId: owner })));
    await db.insert(schema.serverMembers).values([{ serverId: server, userId: owner, role: "owner" }, { serverId: server, userId: human, role: "member" }, { serverId: foreign, userId: stranger, role: "owner" }]);
    await db.insert(schema.channels).values([
      { id: root, serverId: server, name: "private", type: "private" },
      { id: thread, serverId: server, name: "thread", type: "thread", parentMessageId: parent },
      { id: nested, serverId: server, name: "nested", type: "thread", parentMessageId: reply },
      { id: publicCh, serverId: server, name: "public", type: "channel" },
      { id: foreignCh, serverId: foreign, name: "foreign", type: "channel" },
      { id: dm, serverId: server, name: "dm", type: "dm" },
    ]);
    await db.insert(schema.messages).values([{ id: parent, channelId: root, seq: 1 }, { id: reply, channelId: thread, seq: 2 }].map((m) => ({ ...m, serverId: server, senderType: "user", senderId: owner, senderName: "Test", content: "retained" })));
    await db.insert(schema.agents).values([{ id: agent, serverId: server }, { id: foreignAgent, serverId: foreign }, { id: deletedAgent, serverId: server, deletedAt: new Date() }].map((a) => ({ ...a, name: `test-${a.id}`, displayName: "Test", runtime: "codex" })));
    await db.insert(schema.channelMembers).values(channels.filter((id) => id !== foreignCh).map((channelId) => ({ channelId, memberType: "user", memberId: owner })));
    assert.equal((await call(human, root, "members", "POST", { userId: human })).status, 403);
    assert.equal((await call(owner, root, "members", "POST", { userId: stranger })).status, 404);
    assert.equal((await call(owner, foreignCh, "members", "POST", { userId: human })).status, 404);
    assert.equal((await call(owner, root, "members", "POST", { agentId: foreignAgent })).status, 404);
    assert.equal((await call(owner, root, "members", "POST", { agentId: deletedAgent })).status, 404);
    assert.equal((await call(owner, root, "members", "POST", { userId: human, agentId: agent })).status, 400);
    assert.equal((await call(owner, root, "members", "DELETE", {})).status, 400);
    assert.equal((await call(owner, dm, "members", "POST", { userId: human })).status, 403);
    assert.equal((await call(owner, root, "members", "POST", { agentId: agent })).status, 200);
    for (let i = 0; i < 2; i++) assert.equal((await call(owner, root, "members", "POST", { userId: human })).status, 200);
    assert.equal((await call(owner, root, "members", "GET")).result.humans.filter((h: any) => h.userId === human).length, 1);
    assert.equal(await canUserReadChannel(server, root, human), true);
    await db.insert(schema.channelMembers).values([thread, nested].map((channelId) => ({ channelId, memberType: "user", memberId: human })));
    const left = await call(human, root, "leave", "POST");
    assert.equal(left.status, 200);
    assert.deepEqual(left.result.removedChannelIds.sort(), [root, thread, nested].sort());
    assert.equal(await canUserReadChannel(server, root, human), false);
    assert.equal(await canUserReadChannel(server, thread, human), false);
    const memberships = await db.select().from(schema.channelMembers).where(inArray(schema.channelMembers.channelId, [root, thread, nested]));
    assert.equal(memberships.filter((m) => m.memberId === human).length, 0);
    assert.equal(memberships.filter((m) => m.memberId === owner).length, 3);
    assert.equal((await db.select().from(schema.messages).where(eq(schema.messages.id, parent))).length, 1);
    assert.equal((await call(human, root, "join", "POST")).status, 403);
    assert.equal((await call(human, publicCh, "join", "POST")).status, 200);
    assert.equal((await call(human, publicCh, "leave", "POST")).status, 200);
    assert.equal((await call(human, publicCh, "join", "POST")).status, 200);
    assert.equal((await call(human, thread, "leave", "POST")).status, 403);
    assert.equal((await call(human, dm, "leave", "POST")).status, 403);
  } finally {
    await db.delete(schema.channelMembers).where(inArray(schema.channelMembers.channelId, channels));
    await db.delete(schema.messages).where(inArray(schema.messages.serverId, servers));
    await db.delete(schema.channels).where(inArray(schema.channels.serverId, servers));
    await db.delete(schema.agents).where(inArray(schema.agents.serverId, servers));
    await db.delete(schema.serverMembers).where(inArray(schema.serverMembers.serverId, servers));
    await db.delete(schema.servers).where(inArray(schema.servers.id, servers));
    await db.delete(schema.users).where(inArray(schema.users.id, users));
    await sql.end();
  }
});
