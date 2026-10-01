/** The ink card: Untangle's own words. Headline counts decisions, or progress once something is done. */
export function Decisions({ headline, lines, note }: { headline: string; lines: string[]; note?: string | null }) {
  return (
    <section aria-label="Decisions" className="rounded-lg bg-ink p-5 text-ink-inverse">
      <h2 className="voice-lg m-0 mb-3 text-inherit">{headline}</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {lines.map((l) => (
          <li key={l} className="flex gap-3">
            <span className="mt-2.5 size-1.5 flex-none rounded-full bg-ink-inverse opacity-55" aria-hidden="true" />
            <span className="voice">{l}</span>
          </li>
        ))}
      </ul>
      {note && <p className="voice-xs m-0 mt-3.5 opacity-80">{note}</p>}
    </section>
  );
}
