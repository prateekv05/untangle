"use client";

import { useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { useFocusTrap } from "@/lib/use-focus-trap";

/** Bottom sheet: grab bar, title, one serif line, content. Traps focus, closes on Escape or the scrim. */
export function Sheet({ title, voice, onClose, children, tall, preview }: { title: string; voice?: string; onClose: () => void; children: ReactNode; tall?: boolean; preview?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, onClose, !preview);
  return (
    <div className={preview ? "relative h-full" : "fixed inset-0 z-40"}>
      {!preview && <div className="scrim-in absolute inset-0 bg-[rgba(23,20,43,0.5)]" onClick={onClose} aria-hidden="true" />}
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(preview ? "relative" : "sheet-in absolute inset-x-0 bottom-0 mx-auto max-w-[430px] overflow-y-auto overflow-x-hidden", "rounded-t-lg bg-surface px-5 pb-[30px] pt-2.5 shadow-lift outline-none", !preview && (tall ? "max-h-[92dvh]" : "max-h-[88dvh]"))}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-[9px] bg-line" aria-hidden="true" />
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="m-0 min-w-0 text-2xl font-bold leading-7 tracking-[-0.01em]">{title}</h2>
          {!preview && (
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-ink">
              <Icon name="close" />
            </button>
          )}
        </div>
        {voice && <p className="voice mb-3.5 mt-1 text-ink-muted">{voice}</p>}
        {!voice && <div className="h-3.5" />}
        {children}
      </div>
    </div>
  );
}

/** A 52px full-width option row on surface-soft. */
export function SheetOption({ children, onClick, selected }: { children: ReactNode; onClick: () => void; selected?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn("mb-2 flex min-h-[52px] w-full items-center rounded-md bg-surface-soft px-4 text-left font-semibold text-ink", selected && "shadow-[0_0_0_2px_var(--ink)]")}>
      {children}
    </button>
  );
}
