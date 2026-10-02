import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Every text/background pair the UI uses, checked in both themes straight from design/tokens.css.
const css = readFileSync(new URL("../../design/tokens.css", import.meta.url), "utf8");

function tokens(theme: "light" | "dark"): Record<string, string> {
  const block = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`))?.[1] ?? css.match(/:root,\s*\[data-theme="light"\]\s*\{([^}]*)\}/)?.[1] ?? "";
  const out: Record<string, string> = Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
  for (const m of block.matchAll(/--([a-z-]+):\s*var\(--([a-z-]+)\)/g)) out[m[1]] = out[m[2]]; // aliases, such as --focus
  return out;
}

const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const SURFACES = ["ground", "surface", "surface-soft"];
const TINTED = [["outside-ink", "outside-tint"], ["work-ink", "work-tint"], ["home-ink", "home-tint"], ["anywhere-ink", "anywhere-tint"], ["ask-ink", "ask-tint"]];

for (const theme of ["light", "dark"] as const) {
  const t = tokens(theme);
  const need = (fg: string, bg: string, min: number) => assert.ok(ratio(t[fg], t[bg]) >= min, `${theme}: ${fg} on ${bg} is ${ratio(t[fg], t[bg]).toFixed(2)}, needs ${min}`);

  test(`${theme}: tokens were read`, () => assert.ok(Object.keys(t).length > 20));

  test(`${theme}: body text and muted text pass AA on every surface`, () => {
    for (const bg of SURFACES) { need("ink", bg, 4.5); need("ink-muted", bg, 4.5); }
  });

  test(`${theme}: text on tinted chips uses the -ink colour and passes AA`, () => {
    for (const [fg, bg] of TINTED) need(fg, bg, 4.5);
  });

  test(`${theme}: ask and danger text pass AA on surfaces`, () => {
    for (const bg of SURFACES) { need("ask-ink", bg, 4.5); need("danger", bg, 4.5); }
  });

  test(`${theme}: inverse text passes AA on the ink card and button`, () => need("ink-inverse", "ink", 4.5));

  // The thread nodes are decorative (aria-hidden): every block also says where it is in text, which passes above. So they are not held to 3:1.
  test(`${theme}: the focus ring and the check mark pass 3:1 for non-text`, () => {
    for (const bg of SURFACES) need("focus", bg, 3);
    need("ink-inverse", "thread-outside", 3); // the tick inside a finished circle
  });
}
