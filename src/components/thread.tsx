import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { WHERE, type Where } from "@/lib/where";

/**
 * One row of the Thread: time, spine with a 12px node, and the content (a TaskBlock).
 * Spine and nodes are decorative; each block states its time and WhereTag in text.
 * `taut` = the spine pulled to 5px outside-green (inside an Outing).
 */
export function ThreadRow({ time, where, first, last, taut, ring = "ground", index = 0, outingCount, children }: {
  time: string; where: Where; first?: boolean; last?: boolean; taut?: boolean; ring?: "ground" | "outing"; index?: number; outingCount?: number; children: ReactNode;
}) {
  const vars = { "--i": index, "--n": outingCount ?? 0 } as CSSProperties;
  return (
    <div className="grid grid-cols-[48px_24px_minmax(0,1fr)] gap-x-2" style={vars}>
      <div className="time row-time pt-[17px] text-ink-muted">{time}</div>
      <div className="relative" aria-hidden="true">
        <div
          className={cn("spine absolute left-1/2 rounded-[3px]", taut ? "spine-taut w-[5px] -ml-[2.5px] bg-outside" : "w-0.5 -ml-px bg-line")}
          style={{ top: first ? 28 : 0, bottom: last ? "calc(100% - 28px)" : 0 }}
        />
        <div
          className="row-node absolute left-1/2 -ml-1.5 size-3 rounded-full"
          style={{ top: 22, background: WHERE[where].thread, boxShadow: `0 0 0 3px ${ring === "outing" ? "var(--outside-tint)" : "var(--ground)"}` }}
        />
      </div>
      <div className="row-card min-w-0">{children}</div>
    </div>
  );
}

/** A short serif line between outing stops ("on the way back") on the taut thread. */
export function ThreadHop({ text, index = 0 }: { text: string; index?: number }) {
  return (
    <div className="-mt-1 grid grid-cols-[48px_24px_minmax(0,1fr)] gap-x-2" style={{ "--i": index } as CSSProperties}>
      <div />
      <div className="relative" aria-hidden="true">
        <div className="spine spine-taut absolute inset-y-0 left-1/2 -ml-[2.5px] w-[5px] rounded-[3px] bg-outside" />
      </div>
      <p className="voice-sm row-card m-0 pb-2.5 pl-1 text-outside-ink">{text}</p>
    </div>
  );
}

/** "Work starts 09:00" / "Work ends 17:00": a thin labelled rule on the thread. */
export function ThreadMarker({ label }: { label: string }) {
  return (
    <div className="grid h-7 grid-cols-[48px_24px_minmax(0,1fr)] items-center gap-x-2">
      <div />
      <div className="relative h-full" aria-hidden="true"><div className="absolute inset-y-0 left-1/2 -ml-px w-0.5 rounded-[3px] bg-line" /></div>
      <div className="flex items-center gap-2 text-[13px] font-medium leading-[18px] text-ink-muted">
        <span>{label}</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
    </div>
  );
}

/** The "Now, 11:45" marker on a re-planned thread. Ink, not a location colour. */
export function NowMarker({ time }: { time: string }) {
  return (
    <div className="grid h-11 grid-cols-[48px_24px_minmax(0,1fr)] items-center gap-x-2">
      <div />
      <div className="relative h-full" aria-hidden="true">
        <div className="absolute bottom-0 left-1/2 top-1/2 -ml-px w-0.5 bg-line" />
        <div className="absolute left-1/2 top-1/2 -ml-[7px] -mt-[7px] size-3.5 rounded-full bg-ink shadow-[0_0_0_3px_var(--ground)]" />
      </div>
      <div><span className="inline-block rounded-pill bg-ink px-3 py-1 text-[13px] font-semibold leading-[18px] text-ink-inverse">Now, {time}</span></div>
    </div>
  );
}
