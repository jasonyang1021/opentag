// Probe the selected machine's CLI/login; cache successful lists only. No static fallback.
import { requestDaemonByMachine } from "./daemonHub.js";

export interface ModelOption {
  id: string;
  label: string;
  provider?: string;
  default?: boolean;
  thinking?: { levels: { value: string; label: string; description?: string }[]; default?: string };
}

// CLI discovery capabilities. Claude's help-only catalog is not account-aware and is not exposed by the picker.
export const DYNAMIC_RUNTIMES = new Set(["opencode", "cursor", "pi", "hermes", "claude", "codex", "reasonix"]);

const TTL_MS = 60_000; // matches multica's 60s model cache — lists rarely change within a minute
const PROBE_TIMEOUT_MS = 8_000; // bound how long the modal waits on the first probe before fallback
const cache = new Map<string, { models: ModelOption[]; exp: number }>();

// Returns the machine's live model list for a runtime (cached ~60s), or null on miss/offline/timeout/
// empty; the caller exposes an unavailable state, never an invented model list.
export async function getDynamicModels(machineId: string, runtime: string, refresh = false): Promise<ModelOption[] | null> {
  const key = `${machineId}:${runtime}`;
  const hit = cache.get(key);
  if (!refresh && hit && hit.exp > Date.now()) return hit.models;
  if (refresh) cache.delete(key);
  const r = await requestDaemonByMachine(machineId, { type: "probe-models", runtime }, PROBE_TIMEOUT_MS);
  const models = Array.isArray(r?.models) ? (r.models as ModelOption[]) : null;
  if (!models || !models.length) return null; // never cache empty/error — don't lock a transient failure for 60s
  models.sort((a, b) => (b.default ? 1 : 0) - (a.default ? 1 : 0)); // default first → frontend preselects ms[0]
  cache.set(key, { models, exp: Date.now() + TTL_MS });
  return models;
}
