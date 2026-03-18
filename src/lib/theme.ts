import type { ThemePreference } from "../shared/types";

export function resolveTheme(theme: ThemePreference): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return theme;
}

export function applyTheme(theme: ThemePreference): void {
  document.documentElement.dataset.theme = resolveTheme(theme);
}
