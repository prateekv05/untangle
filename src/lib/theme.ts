export type Theme = "light" | "dark";

export const THEME_KEY = "untangle-theme";

// Runs before first paint (inlined in <head>), so the page never flashes the wrong theme.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="system"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}else if(t!=="dark"){t="light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;

export function currentTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be blocked; the theme still applies for this visit.
  }
}

export type ThemePref = Theme | "system";

/** Light unless the user chose otherwise. */
export function themePreference(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "dark" || t === "system" ? t : "light";
  } catch {
    return "light";
  }
}

/** "system" is remembered as its own choice and follows the OS; with no choice stored the app is light. */
export function setThemePreference(pref: ThemePref): void {
  if (pref !== "system") return setTheme(pref);
  try {
    localStorage.setItem(THEME_KEY, "system");
  } catch {
    // Storage can be blocked; the theme still applies for this visit.
  }
  document.documentElement.setAttribute("data-theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
