import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../web/src/views/CollaborationGraph.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../web/src/views/collaborationGraph.css", import.meta.url), "utf8");

test("graph has one unfiltered organic layout and interaction-count curves", () => {
  assert.match(source, /buildMemberGraph\(data \?\? EMPTY\)/);
  assert.match(source, /layoutMemberGraph\(graph.nodes, graph.edges, width, height\)/);
  assert.match(source, /edgeCurveOffsets\(item.weight, direction, distance\)/);
  assert.doesNotMatch(source, /filterMemberGraph|layoutOrbitGraph|shortestMemberPath|<input|<select|gx-filters|gx-experience/);
  assert.doesNotMatch(source + css, /gx-night|gx-atlas|gx-flow|gx-orbits|setNight|setMotion|setQuery/);
});

test("remaining graph labels resolve in both supported languages", () => {
  const keys = [...source.matchAll(/(?:graphExplorer|members)\.[A-Za-z]+/g)].map(match => match[0]);
  for (const lang of ["en", "zh"]) {
    const locale = JSON.parse(readFileSync(new URL(`../web/src/locales/${lang}.json`, import.meta.url), "utf8"));
    for (const key of keys) {
      const [group, name] = key.split(".");
      assert.equal(typeof locale[group!][name!], "string", `${lang}: ${key}`);
    }
    assert.equal(typeof locale.graphExplorer.human, "string");
    assert.equal(typeof locale.graphExplorer.agent, "string");
  }
});
