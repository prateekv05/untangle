import { cn } from "@/lib/cn";

/** Two or three exclusive options. Real radio semantics. */
export function SegmentedControl<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md bg-surface-soft p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn("min-h-11 flex-1 rounded-[12px] border-0 text-[15px] leading-5", on ? "bg-surface font-semibold text-ink shadow-[0_0_0_1px_var(--line)]" : "bg-transparent font-medium text-ink-muted")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
