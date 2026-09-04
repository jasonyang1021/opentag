// Minimal stdio MCP server for the local Codex Artifact Runtime. It deliberately exposes
// only validated, read-only path discovery; the agent sandbox remains responsible for writes.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface WorkspaceDependencies { RUNTIME_NODE: string; RUNTIME_NODE_MODULES: string; RUNTIME_PYTHON: string; RUNTIME_PYTHON_PACKAGES: string; RUNTIME_BIN_DIR: string; RUNTIME_OVERRIDE_BIN_DIR: string; }
function isFile(value: string): boolean { try { return fs.statSync(value).isFile(); } catch { return false; } }
function isDirectory(value: string): boolean { try { return fs.statSync(value).isDirectory(); } catch { return false; } }

/** Resolve the installed desktop runtime without accepting an agent-controlled path. */
export function resolveWorkspaceDependencies(runtimeRoot = process.env.OPEN_TAG_CODEX_RUNTIME_ROOT ?? path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime")): WorkspaceDependencies {
  const dependencies = path.join(runtimeRoot, "dependencies");
  const node = path.join(dependencies, "node", "bin", process.platform === "win32" ? "node.exe" : "node");
  const nodeModules = path.join(dependencies, "node", "node_modules");
  const pythonRoot = path.join(dependencies, "python");
  const python = path.join(pythonRoot, process.platform === "win32" ? "python.exe" : "bin/python");
  const binDir = path.join(dependencies, "bin", "fallback"); const overrideBinDir = path.join(dependencies, "bin", "override");
  if (![node, python].every(isFile) || ![nodeModules, pythonRoot, binDir, overrideBinDir].every(isDirectory)) throw new Error("Codex Artifact Runtime is not installed or is incomplete");
  return { RUNTIME_NODE: node, RUNTIME_NODE_MODULES: nodeModules, RUNTIME_PYTHON: python, RUNTIME_PYTHON_PACKAGES: pythonRoot, RUNTIME_BIN_DIR: binDir, RUNTIME_OVERRIDE_BIN_DIR: overrideBinDir };
}
function reply(id: unknown, result?: unknown, error?: string): void { if (id !== undefined) process.stdout.write(JSON.stringify(error ? { jsonrpc: "2.0", id, error: { code: -32000, message: error } } : { jsonrpc: "2.0", id, result }) + "\n"); }
export function handleMcpRequest(request: any): void {
  if (request?.method === "initialize") return reply(request.id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "open-tag-workspace-dependencies", version: "1.0.0" } });
  if (request?.method === "tools/list") return reply(request.id, { tools: [{ name: "load_workspace_dependencies", description: "Return validated paths for the local Codex Artifact Runtime.", inputSchema: { type: "object", properties: {}, additionalProperties: false } }] });
  if (request?.method === "tools/call") { if (request.params?.name !== "load_workspace_dependencies") return reply(request.id, undefined, "unknown tool"); try { return reply(request.id, { content: [{ type: "text", text: JSON.stringify(resolveWorkspaceDependencies()) }] }); } catch (cause) { return reply(request.id, undefined, cause instanceof Error ? cause.message : String(cause)); } }
  if (request?.id !== undefined) reply(request.id, undefined, "method not found");
}
if (process.argv.includes("--open-tag-workspace-dependencies-mcp")) { let buffer = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { buffer += chunk; const lines = buffer.split("\n"); buffer = lines.pop() ?? ""; for (const line of lines) { try { handleMcpRequest(JSON.parse(line)); } catch { /* ignore malformed input */ } } }); }
