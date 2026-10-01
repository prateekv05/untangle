import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A tappable pill: quick starts, answers, options. `dashed` is the "+ Yours" style. */
export function Chip({ children, dashed, small, selected, className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; dashed?: boolean; small?: boolean; selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={rest.role ? undefined : selected}
      className={cn(
        "rounded-pill border bg-surface text-ink text-sm leading-5 shrink-0",
        small ? "min-h-10 px-3.5 font-medium" : "min-h-11 px-4 font-semibold",
        dashed ? "border-dashed border-line text-ink-muted" : selected ? "border-ink" : "border-line",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
