// Explicit lifecycle operations and reconnect restoration share one per-agent FIFO.
// A stop queued behind a restore always runs last; unrelated agents remain independent.
const tails = new Map<string, Promise<void>>();

export async function serializeAgentLifecycle<T>(serverId: string, agentId: string, action: () => Promise<T>): Promise<T> {
  const key = `${serverId}:${agentId}`;
  const previous = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  tails.set(key, current);
  await previous;
  try { return await action(); }
  finally {
    release();
    if (tails.get(key) === current) tails.delete(key);
  }
}
