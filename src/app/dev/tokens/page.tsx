import { notFound } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const THEMES = ["light", "dark"] as const;

const SURFACES = ["ground", "surface", "surface-soft", "line", "ink", "ink-muted", "ink-inverse"];
const WHERE = [
  { name: "outside", thread: "--thread-outside", ink: "--outside-ink", tint: "--outside-tint" },
  { name: "work", thread: "--thread-work", ink: "--work-ink", tint: "--work-tint" },
  { name: "home", thread: "--thread-home", ink: "--home-ink", tint: "--home-tint" },
  { name: "anywhere", thread: "--thread-anywhere", ink: "--anywhere-ink", tint: "--anywhere-tint" },
  { name: "ask", thread: "--ask", ink: "--ask-ink", tint: "--ask-tint" },
];
const SPACING = [1, 2, 3, 4, 5, 6, 8, 10];
const RADII = ["sm", "md", "lg", "pill"];

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <span className="size-9 shrink-0 rounded-sm border border-line" style={{ background: `var(${token})` }} />
      <code className="text-xs text-ink-muted">{token}</code>
    </div>
  );
}

function Panel({ theme }: { theme: (typeof THEMES)[number] }) {
  return (
    <section data-theme={theme} className="min-w-0 rounded-lg border border-line bg-ground p-5 text-ink">
      <h2 className="text-lg font-bold tracking-tight">{theme} theme</h2>

      <h3 className="mt-5 mb-1 text-sm font-semibold text-ink-muted">Surfaces and ink</h3>
      {SURFACES.map((s) => <Swatch key={s} token={`--${s}`} />)}

      <h3 className="mt-5 mb-1 text-sm font-semibold text-ink-muted">Where colours</h3>
      {WHERE.map((w) => (
        <div key={w.name} className="mb-2">
          <p className="text-sm font-semibold">{w.name}</p>
          <Swatch token={w.thread} />
          <Swatch token={w.ink} />
          <Swatch token={w.tint} />
        </div>
      ))}
      <Swatch token="--danger" />
      <Swatch token="--focus" />

      <h3 className="mt-5 mb-2 text-sm font-semibold text-ink-muted">Type: two voices</h3>
      <div className="rounded-md bg-surface p-4">
        <p className="text-2xl font-bold tracking-tight">Plan for today</p>
        <p className="mt-1 text-base font-medium">Finish SQL assignment</p>
        <p className="text-sm text-ink-muted">1 h 30 min, 09:00</p>
        <p className="mt-3 font-serif text-lg">You are already out at the gym, so this goes on the way back home.</p>
        <p className="mt-1 font-serif text-base font-medium text-ask-ink">I guessed 45 min. Tap to set it.</p>
      </div>

      <h3 className="mt-5 mb-2 text-sm font-semibold text-ink-muted">Spacing</h3>
      {SPACING.map((n) => (
        <div key={n} className="mb-1 flex items-center gap-3">
          <code className="w-16 text-xs text-ink-muted">space-{n}</code>
          <span className="h-3 rounded-pill bg-work" style={{ width: `var(--space-${n})` }} />
        </div>
      ))}

      <h3 className="mt-5 mb-2 text-sm font-semibold text-ink-muted">Radius</h3>
      <div className="flex flex-wrap gap-3">
        {RADII.map((r) => (
          <div key={r} className="text-center">
            <span className="block h-14 w-14 border-2 border-work bg-work-tint" style={{ borderRadius: `var(--radius-${r})` }} />
            <code className="text-xs text-ink-muted">{r}</code>
          </div>
        ))}
      </div>

      <h3 className="mt-5 mb-2 text-sm font-semibold text-ink-muted">Shadow (sheets and toast only)</h3>
      <div className="h-14 rounded-md bg-surface" style={{ boxShadow: "var(--shadow-lift)" }} />
    </section>
  );
}

export default function TokensPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-[900px] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Design tokens</h1>
        <ThemeToggle />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {THEMES.map((t) => <Panel key={t} theme={t} />)}
      </div>
    </main>
  );
}
