"use client";

import { cn } from "@/lib/cn";
import { needsDuration } from "@/lib/guess";
import { factPills } from "@/lib/flow";
import type { Block, Task } from "@/lib/schemas";
import { fmtDuration } from "@/lib/time";
import { Icon } from "./icon";
import { FactPill, WhereTag } from "./where-tag";

/**
 * One task on the Thread. Tap the card (or its name) to expand; tap the circle to finish.
 * Expanded: Finished, Edit, Move later. Finished: name struck through, circle filled, block stays put.
 */
export function TaskBlock({ task, block, done, expanded, was, locked, onExpand, onToggleDone, onEdit, onMove }: {
  task: Task; block: Block; done?: boolean; expanded?: boolean; was?: string; locked?: boolean;
  onExpand?: () => void; onToggleDone?: () => void; onEdit?: () => void; onMove?: () => void;
}) {
  const guessed = needsDuration(task);
  const pills = factPills(task);
  const dur = fmtDuration(block.durationMin);
  return (
    <div
      onClick={onExpand}
      className={cn("mb-3 rounded-md border border-line bg-surface px-4 py-3.5", onExpand && "cursor-pointer")}
      data-testid={`block-${task.id}`}
      data-done={done ? "true" : undefined}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(e) => { e.stopPropagation(); onExpand?.(); }}
          className="relative min-h-6 flex-1 border-0 bg-transparent p-0 text-left after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] text-base font-semibold leading-6 text-ink"
        >
          <span className={cn(done && "text-ink-muted line-through decoration-2")}>{task.title}</span>
          <span className="sr-only">, {block.start}{done ? ", finished" : ""}</span>
        </button>
        <button
          type="button"
          role="checkbox"
          aria-checked={!!done}
          aria-label={`${done ? "Undo finish" : "Finish"} ${task.title}`}
          disabled={locked}
          onClick={(e) => { e.stopPropagation(); onToggleDone?.(); }}
          className="-m-2.5 grid size-11 shrink-0 place-items-center border-0 bg-transparent"
        >
          <span className={cn("grid size-6 place-items-center rounded-full border-2 text-ink-inverse", done ? "border-outside bg-outside" : "border-line bg-transparent")}>
            {done && <Icon name="check" size={13} weight={3.5} />}
          </span>
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-medium leading-[18px] text-ink-muted">
        <WhereTag where={task.location} />
        <span>{task.durationSource === "estimated" ? `about ${dur}` : dur}</span>
        {guessed && <FactPill ask>I guessed {dur}</FactPill>}
        {pills.map((p) => <FactPill key={p}>{p}</FactPill>)}
        {was && <FactPill>was {was}</FactPill>}
      </div>
      <p className="voice m-0 mt-2.5 rounded-sm bg-surface-soft px-3 py-[9px]">{block.reason}</p>
      {expanded && (
        <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
          <ActionButton tone="done" disabled={locked} onClick={onToggleDone}>{done ? "Undo" : "Finished"}</ActionButton>
          <ActionButton disabled={locked} onClick={onEdit}>Edit</ActionButton>
          <ActionButton disabled={locked} onClick={onMove}>Move later</ActionButton>
        </div>
      )}
    </div>
  );
}

function ActionButton({ children, onClick, tone, disabled }: { children: string; onClick?: () => void; tone?: "done"; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cn("min-h-11 flex-1 rounded-sm border-0 text-sm font-semibold leading-5", tone === "done" ? "bg-outside-tint text-outside-ink" : "bg-surface-soft text-ink")}>
      {children}
    </button>
  );
}
