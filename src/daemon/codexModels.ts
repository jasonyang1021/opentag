import { spawnSafe } from "./spawnSafe.js";
import { killTree } from "./killTree.js";
import type { DiscoveredModel } from "./listModels.js";

export function parseCodexModelPage(result: any): DiscoveredModel[] {
  if (!Array.isArray(result?.data)) throw new Error("Invalid Codex model list");
  return result.data.filter((m: any) => m && m.hidden !== true && typeof m.model === "string" && m.model).map((m: any) => {
    const levels = (Array.isArray(m.supportedReasoningEfforts) ? m.supportedReasoningEfforts : [])
      .filter((e: any) => typeof e?.reasoningEffort === "string")
      .map((e: any) => ({ value: e.reasoningEffort, label: e.reasoningEffort, description: e.description }));
    return { id: m.model, label: m.displayName || m.model, provider: "openai", default: m.isDefault === true,
      ...(levels.length ? { thinking: { levels, default: m.defaultReasoningEffort } } : {}) };
  });
}

// Read-only discovery: no thread, turn, approval or inference is started. One deadline covers all pages.
export function discoverCodexModels(timeoutMs = 7000, launch: typeof spawnSafe = spawnSafe): Promise<DiscoveredModel[] | null> {
  return new Promise((resolve) => {
    const env = { ...process.env }; delete env.NODE_OPTIONS;
    const proc = launch("codex", ["app-server", "--listen", "stdio://"], { env, stdio: ["pipe", "pipe", "pipe"] });
    let done = false, buffer = "", id = 1, total = 0;
    const models = new Map<string, DiscoveredModel>();
    const cursors = new Set<string>();
    const finish = (result: DiscoveredModel[] | null) => {
      if (done) return;
      done = true; clearTimeout(timer);
      proc.stdin?.end(); killTree(proc); resolve(result);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const send = (method: string, params: unknown, requestId?: number) => proc.stdin?.write(JSON.stringify({ method, params, ...(requestId ? { id: requestId } : {}) }) + "\n");
    proc.on("error", () => finish(null));
    proc.on("exit", () => finish(null));
    proc.stdin?.on("error", () => finish(null));
    proc.stderr?.resume(); // Drain diagnostics; do not leak credentials/config into HTTP responses.
    proc.stdout?.setEncoding("utf8");
    proc.stdout?.on("data", (chunk: string) => {
      if (done) return;
      total += chunk.length;
      if (total > 1024 * 1024) return finish(null);
      buffer += chunk;
      let end: number;
      while (!done && (end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const msg = JSON.parse(line);
          if (msg.id !== id) continue;
          if (msg.error) return finish(null);
          if (id === 1) {
            send("initialized", {});
            send("model/list", { limit: 100, includeHidden: false }, ++id);
          } else {
            for (const m of parseCodexModelPage(msg.result)) models.set(m.id, m);
            const cursor = msg.result.nextCursor;
            if (!cursor) return finish(models.size ? [...models.values()] : null);
            if (typeof cursor !== "string" || cursors.has(cursor) || cursors.size >= 20) return finish(null);
            cursors.add(cursor);
            send("model/list", { limit: 100, includeHidden: false, cursor }, ++id);
          }
        } catch { return finish(null); }
      }
    });
    send("initialize", { clientInfo: { name: "open-tag-model-discovery", version: "0.1.0" } }, id);
  });
}
