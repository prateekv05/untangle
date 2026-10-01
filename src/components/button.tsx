import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icon";

type Variant = "primary" | "secondary" | "quiet" | "pill" | "danger";

const BASE = "inline-flex items-center justify-center gap-2.5 font-semibold transition-colors duration-150";
const VARIANTS: Record<Variant, string> = {
  primary: "w-full min-h-[52px] rounded-md border-0 bg-ink text-ink-inverse text-base leading-6",
  secondary: "w-full min-h-[48px] rounded-md border border-line bg-transparent text-ink text-[15px] leading-5",
  quiet: "min-h-11 px-2 border-0 bg-transparent text-ink-muted underline underline-offset-[3px] text-sm font-medium leading-5",
  pill: "min-h-11 px-4 rounded-pill border border-line bg-surface text-ink text-sm leading-5",
  danger: "min-h-11 px-2 border-0 bg-transparent text-danger underline underline-offset-[3px] text-sm font-medium leading-5",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName; children: ReactNode };

/** One primary per screen. Buttons say what happens. */
export function Button({ variant = "primary", icon, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn(BASE, VARIANTS[variant], className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
