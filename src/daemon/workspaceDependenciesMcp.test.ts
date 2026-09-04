import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { resolveWorkspaceDependencies } from "./workspaceDependenciesMcp.js";

test("workspace dependency resolver returns only a complete runtime tree", () => {
  const runtimeRoot = mkdtempSync(path.join(tmpdir(), "open-tag-runtime-"));
  const dependencies = path.join(runtimeRoot, "dependencies");
  const node = path.join(dependencies, "node", "bin", process.platform === "win32" ? "node.exe" : "node");
  const pythonRoot = path.join(dependencies, "python");
  const python = path.join(pythonRoot, process.platform === "win32" ? "python.exe" : "bin/python");

  try {
    for (const directory of [
      path.dirname(node),
      path.join(dependencies, "node", "node_modules"),
      path.dirname(python),
      path.join(dependencies, "bin", "fallback"),
      path.join(dependencies, "bin", "override"),
    ]) mkdirSync(directory, { recursive: true });
    writeFileSync(node, "");
    writeFileSync(python, "");

    const resolved = resolveWorkspaceDependencies(runtimeRoot);
    assert.equal(resolved.RUNTIME_NODE, node);
    assert.equal(resolved.RUNTIME_PYTHON, python);
    assert.equal(resolved.RUNTIME_NODE_MODULES, path.join(dependencies, "node", "node_modules"));

    rmSync(resolved.RUNTIME_OVERRIDE_BIN_DIR, { recursive: true });
    assert.throws(() => resolveWorkspaceDependencies(runtimeRoot), /not installed or is incomplete/);
  } finally {
    rmSync(runtimeRoot, { recursive: true, force: true });
  }
});
