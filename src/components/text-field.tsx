import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; invalid?: boolean; trailing?: ReactNode };

/** A real <label> + <input>. 48px tall, 16px text so iOS does not zoom. */
export function TextField({ label, id, invalid, trailing, className, ...rest }: Props) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium leading-[18px] text-ink-muted">{label}</label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={invalid || undefined}
          className={cn(
            "box-border min-h-12 w-full rounded-sm border bg-surface px-3.5 text-base text-ink",
            invalid ? "border-ask" : "border-line",
            trailing ? "pr-14" : "",
            className,
          )}
          {...rest}
        />
        {trailing && <div className="absolute right-0 top-0 grid size-12 place-items-center">{trailing}</div>}
      </div>
    </div>
  );
}
