import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Use a migrated, isolated local test DB; never infer or reuse a production URL.
test("channel Files collects posted thread artifacts without crossing access boundaries", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = new URL(process.env.TEST_DATABASE_URL!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && /test/.test(url.pathname), "Requires a local test database");
  process.env.DATABASE_URL = url.toString();
  const { db, schema, sql } = await import("../src/db/index.ts");
  const { listChannelFiles } = await import("../src/server/channelFiles.ts");
  const { eq, inArray } = await import("drizzle-orm");
  const owner = randomUUID(), outsider = randomUUID(), server = randomUUID(), foreign = randomUUID();
  const root = randomUUID(), thread = randomUUID(), other = randomUUID(), foreignChannel = randomUUID();
  const parent = randomUUID(), reply = randomUUID(), otherMessage = randomUUID(), foreignMessage = randomUUID();
  const userIds = [owner, outsider], serverIds = [server, foreign];
  try {
    await db.insert(schema.users).values(userIds.map((id) => ({ id, name: `test-${id}`, displayName: "Test", email: `${id}@example.test` })));
    await db.insert(schema.servers).values(serverIds.map((id) => ({ id, name: "Test", slug: `test-${id}`, ownerId: owner })));
    await db.insert(schema.serverMembers).values(userIds.map((userId) => ({ userId, serverId: server, role: "member" })));
    await db.insert(schema.channels).values([
      { id: root, serverId: server, name: "private-test", type: "private" },
      { id: thread, serverId: server, name: "thread-test", type: "thread", parentMessageId: parent },
      { id: other, serverId: server, name: "other", type: "channel" },
      { id: foreignChannel, serverId: foreign, name: "foreign", type: "channel" },
    ]);
    await db.insert(schema.channelMembers).values({ channelId: root, memberType: "user", memberId: owner });
    await db.insert(schema.messages).values([
      { id: parent, channelId: root, serverId: server, seq: 1 }, { id: reply, channelId: thread, serverId: server, seq: 2 },
      { id: otherMessage, channelId: other, serverId: server, seq: 3 }, { id: foreignMessage, channelId: foreignChannel, serverId: foreign, seq: 1 },
    ].map((m) => ({ ...m, senderType: "user", senderId: owner, senderName: "Test", content: "Test" })));
    await db.insert(schema.attachments).values([
      { channelId: root, messageId: parent, serverId: server, filename: "root.txt" },
      { channelId: thread, messageId: reply, serverId: server, filename: "result.txt" },
      { channelId: root, messageId: null, serverId: server, filename: "unsent.txt" },
      { channelId: other, messageId: otherMessage, serverId: server, filename: "other.txt" },
      { channelId: foreignChannel, messageId: foreignMessage, serverId: foreign, filename: "foreign.txt" },
    ].map((a) => ({ ...a, storageKey: `test/${randomUUID()}`, uploaderType: "user", uploaderId: owner })));
    const files = await listChannelFiles(server, root, owner);
    assert.deepEqual(files?.map((f) => f.filename).sort(), ["result.txt", "root.txt"]);
    assert.equal(files?.find((f) => f.filename === "result.txt")?.source.parentMessageId, parent);
    assert.equal(files?.find((f) => f.filename === "result.txt")?.channelId, thread);
    assert.equal(await listChannelFiles(server, root, outsider), null);
    assert.equal(await listChannelFiles(server, foreignChannel, owner), null);
    await db.update(schema.channels).set({ deletedAt: new Date() }).where(eq(schema.channels.id, thread));
    assert.deepEqual((await listChannelFiles(server, root, owner))?.map((f) => f.filename), ["root.txt"]);
    await db.delete(schema.channelMembers).where(eq(schema.channelMembers.channelId, root));
    assert.equal(await listChannelFiles(server, root, owner), null);
  } finally {
    await db.delete(schema.attachments).where(inArray(schema.attachments.serverId, serverIds));
    await db.delete(schema.messages).where(inArray(schema.messages.serverId, serverIds));
    await db.delete(schema.channelMembers).where(inArray(schema.channelMembers.channelId, [root, thread, other, foreignChannel]));
    await db.delete(schema.channels).where(inArray(schema.channels.serverId, serverIds));
    await db.delete(schema.serverMembers).where(inArray(schema.serverMembers.serverId, serverIds));
    await db.delete(schema.servers).where(inArray(schema.servers.id, serverIds));
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await sql.end();
  }
});
