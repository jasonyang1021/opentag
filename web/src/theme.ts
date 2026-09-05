export const THEMES = ["light", "dark", "collaboration"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "open-tag.theme";

export function isTheme(value: string | null): value is Theme {
  return THEMES.includes(value as Theme);
}

export function getTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  return isTheme(saved) ? saved : "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function saveTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}
