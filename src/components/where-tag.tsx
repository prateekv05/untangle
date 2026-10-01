import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { WHERE, type Where } from "@/lib/where";
import { Icon } from "./icon";

/** Names where a task happens. The only place the four thread colours appear as text and fill. */
export function WhereTag({ where, chevron, onClick, label }: { where: Where; chevron?: boolean; onClick?: () => void; label?: string }) {
  const w = WHERE[where];
  const cls = cn("inline-flex items-center gap-1.5 rounded-pill py-[3px] pl-2 pr-2.5 text-[13px] font-semibold leading-[18px]", w.tag);
  const inner = (
    <>
      <span className={cn("size-[7px] rounded-full", w.dot)} />
      {w.label}
      {chevron && <Icon name="chevron" size={12} weight={2.2} />}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={label ?? `Where: ${w.label}. Change`} className={cn(cls, "min-h-8")}>{inner}</button>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

/** The time chip. auto = dashed safe estimate; ask = Untangle needs the user ("How long?"); set = a plain duration. */
export function TimeChip({ state, children, chevron, onClick, label }: { state: "auto" | "ask" | "set"; children: ReactNode; chevron?: boolean; onClick?: () => void; label?: string }) {
  const cls = cn(
    "inline-flex items-center gap-1.5 rounded-pill py-1 pl-3 pr-2.5 text-[13px] font-semibold leading-[18px]",
    state === "auto" && "border border-dashed border-line bg-transparent text-ink-muted",
    state === "ask" && "border border-ask bg-ask-tint text-ask-ink",
    state === "set" && "border border-line bg-surface text-ink",
  );
  const inner = (<>{children}{chevron && <Icon name="chevron" size={12} weight={2.2} />}</>);
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={label} className={cn(cls, "min-h-8")}>{inner}</button>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

/** Facts about a task: "Fixed at 17:00", "Due tomorrow", "was 09:00". `ask` marks a guess. */
export function FactPill({ children, ask }: { children: ReactNode; ask?: boolean }) {
  return (
    <span className={cn("rounded-pill px-2.5 py-1 text-[13px] font-semibold leading-[18px]", ask ? "bg-ask-tint text-ask-ink" : "bg-surface-soft text-ink-muted")}>
      {children}
    </span>
  );
}
