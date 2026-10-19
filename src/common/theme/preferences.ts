import { useCallback, useSyncExternalStore } from "react";

/* Per-device display preferences: colour theme and text size, kept in localStorage
   and applied as attributes on <html> (tokens.css and base.css read them). */

export type Theme = "light" | "dark";
export type TextSize = "normal" | "large";

const THEME_KEY = "school.theme";
const TEXT_KEY = "school.textSize";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
};

const systemTheme = (): Theme => (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/* Run once before React renders, so the first paint already has the right theme */
export function applyStoredPreferences() {
  const theme = read(THEME_KEY);
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  if (read(TEXT_KEY) === "large") document.documentElement.dataset.textSize = "large";
}

/* One store per preference, so every toggle on screen shows the same state */
function store<T extends string>(read: () => T) {
  const listeners = new Set<() => void>();
  return {
    get: read,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    notify: () => listeners.forEach(fn => fn())
  };
}

const themeStore = store<Theme>(() => (document.documentElement.dataset.theme as Theme | undefined) ?? systemTheme());
const textStore = store<TextSize>(() => (document.documentElement.dataset.textSize === "large" ? "large" : "normal"));

window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => themeStore.notify());

export function useTheme() {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.get);
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    write(THEME_KEY, next);
    themeStore.notify();
  }, []);
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}

export function useTextSize() {
  const size = useSyncExternalStore(textStore.subscribe, textStore.get);
  const setSize = useCallback((next: TextSize) => {
    if (next === "large") document.documentElement.dataset.textSize = "large";
    else delete document.documentElement.dataset.textSize;
    write(TEXT_KEY, next);
    textStore.notify();
  }, []);
  return { size, setSize, toggle: () => setSize(size === "large" ? "normal" : "large") };
}
