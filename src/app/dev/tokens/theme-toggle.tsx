"use client";

import { currentTheme, setTheme } from "@/lib/theme";

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="min-h-11 rounded-pill border border-line bg-surface px-4 text-sm font-semibold text-ink"
      onClick={() => setTheme(currentTheme() === "dark" ? "light" : "dark")}
    >
      Switch page theme
    </button>
  );
}
