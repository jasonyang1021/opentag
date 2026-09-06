export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "open-tag.theme";

export function isTheme(value: string | null): value is Theme {
  return THEMES.includes(value as Theme);
}

export function getTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "collaboration") return "light"; // Retired light-based skin.
    return isTheme(saved) ? saved : "dark";
  } catch { return "dark"; }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function saveTheme(theme: Theme) {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Theme still works for this session. */ }
  applyTheme(theme);
}
