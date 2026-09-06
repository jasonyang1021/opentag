import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { THEMES, getTheme, isTheme, saveTheme } from "../web/src/theme.ts";

test("only light/dark are selectable; old skin maps to light and storage failures are safe", () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const document = Object.getOwnPropertyDescriptor(globalThis, "document");
  const values = new Map<string, string>();
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: "" } };
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: root } });
    assert.deepEqual(THEMES, ["light", "dark"]);
    assert.equal(isTheme("collaboration"), false);
    assert.equal(getTheme(), "dark");
    values.set("open-tag.theme", "collaboration");
    assert.equal(getTheme(), "light");
    for (const theme of THEMES) {
      saveTheme(theme);
      assert.equal(getTheme(), theme);
      assert.equal(root.dataset.theme, theme);
      assert.equal(root.style.colorScheme, theme);
    }
    values.set("open-tag.theme", "invalid");
    assert.equal(getTheme(), "dark");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
    assert.equal(getTheme(), "dark");
    assert.doesNotThrow(() => saveTheme("light"));
    assert.equal(root.dataset.theme, "light");
  } finally {
    if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
    if (document) Object.defineProperty(globalThis, "document", document); else Reflect.deleteProperty(globalThis, "document");
  }
});

const css = readFileSync(new URL("../web/src/styles.css", import.meta.url), "utf8");
const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([\w-]+):([^;]+)(?:;|$)/g)].map(m => [m[1], m[2]]));
const light = tokens(css.match(/:root\{([^}]+)\}/)![1]!);
const dark = { ...light, ...tokens(css.match(/:root\[data-theme="dark"\]\{([^}]+)\}/)![1]!) };
function luminance(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map(c => c + c).join("");
  const rgb = h.match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
}
for (const [name, palette] of Object.entries({ light, dark })) {
  test(`${name}: main text, muted text, highlights and status messages remain readable`, () => {
    const pairs = [
      ...["surface", "canvas", "surface-strong", "graph-canvas"].flatMap(bg => ["ink", "ink-2", "body", "muted"].map(fg => [fg, bg])),
      ["ink", "selection"], ["ink", "mention"], ["error", "error-soft"],
      ["tint-blue-ink", "tint-blue"], ["tint-lav-ink", "tint-lav"], ["tint-rose-ink", "tint-rose"],
      ["link-blue", "surface"], ["on-ink", "ink-2"], ["avatar-ink", "g-lav"],
    ];
    for (const [fg, bg] of pairs) {
      const a = luminance(palette[fg!]!), b = luminance(palette[bg!]!);
      const contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      assert.ok(contrast >= 4.5, `${name} ${fg}/${bg}: ${contrast.toFixed(2)}`);
    }
  });
}
test("retired styles are removed and previews use matching palette values", () => {
  assert.doesNotMatch(css, /data-theme="collaboration"|theme-choice-collaboration/);
  for (const [name, palette] of Object.entries({ light, dark })) {
    const preview = tokens(css.match(new RegExp(`\\.theme-choice-${name}\\{([^}]+)\\}`))![1]!);
    for (const key of ["canvas", "surface", "ink"]) assert.equal(preview[`preview-${key}`], palette[key]);
    assert.equal(preview["preview-accent"], palette.selection);
  }
});
