import type { CSSProperties, ReactNode } from "react";

/** The grouped stops of one trip out of the house, on a taut thread. Rows inside are ThreadRow taut. */
export function Outing({ summary, index = 0, children }: { summary: string; index?: number; children: ReactNode }) {
  return (
    <section aria-label="One outing" className="outing-box -mx-2 mb-3 rounded-lg border-[1.5px] border-dashed border-outside bg-outside-tint px-3 pb-0.5 pt-3.5" style={{ "--i": index } as CSSProperties}>
      <div className="flex items-baseline justify-between gap-3 px-2 pb-3">
        <h3 className="m-0 text-2xl font-bold leading-7 tracking-[-0.01em] text-outside-ink">One outing</h3>
        <span className="text-[13px] font-medium leading-[18px] text-outside-ink">{summary}</span>
      </div>
      {children}
    </section>
  );
}
