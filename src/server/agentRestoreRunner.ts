type RestoreResult = { ok: boolean; reason?: string };

/** Sequential admission avoids a reconnect spawn storm; daemon admission can still queue. */
export async function runAgentRestore(options: {
  candidates: string[];
  runningIds: string[];
  isCurrent: () => boolean;
  start: (id: string) => Promise<RestoreResult>;
  report: (id: string, result: RestoreResult) => void;
}): Promise<string[]> {
  const running = new Set(options.runningIds);
  for (const id of new Set(options.candidates)) {
    if (!options.isCurrent()) break;
    if (running.has(id)) continue;
    let result: RestoreResult;
    try { result = await options.start(id); }
    catch (error) { result = { ok: false, reason: String(error) }; }
    options.report(id, result);
    if (result.ok) running.add(id);
  }
  return [...running];
}
