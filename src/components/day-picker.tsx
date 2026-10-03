"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export type DayOption<T extends string> = { value: T; label: string };

/** The date heading with an arrow beside it. Tapping opens a small menu to jump to today, tomorrow or the day after. */
export function DayPicker<T extends string>({ heading, value, options, onChange }: { heading: string; value: T; options: DayOption<T>[]; onChange: (v: T) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)} className="flex min-h-11 items-center gap-2 border-0 bg-transparent p-0 text-left text-ink">
        <h1 className="m-0 text-[28px] font-bold leading-8 tracking-[-0.02em]">{heading}</h1>
        <span className="grid size-8 flex-none place-items-center rounded-pill bg-surface-soft text-ink-muted"><Icon name="chevron" size={16} className={cn("transition-transform", open && "rotate-180")} /></span>
      </button>
      {open && (
        <ul id={menuId} role="listbox" aria-label="Day" className="absolute left-0 top-full z-20 m-0 mt-1 min-w-[200px] list-none rounded-lg border border-line bg-surface p-1.5 shadow-lg">
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button type="button" onClick={() => { setOpen(false); onChange(o.value); }} className={cn("flex min-h-11 w-full items-center justify-between gap-3 rounded-md border-0 bg-transparent px-3 text-left text-[15px] font-medium text-ink", o.value === value && "bg-surface-soft font-bold")}>
                {o.label}
                {o.value === value && <Icon name="check" size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
