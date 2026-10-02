"use client";

import { useState, type ReactNode } from "react";
import { decisionsShown, fmtMoveDate, outingSummary, type Moved, type Replan } from "@/lib/flow";
import type { Preset } from "@/lib/guess";
import type { PlanMode } from "@/lib/planner";
import type { Block, Plan, Settings, Task } from "@/lib/schemas";
import { toMin } from "@/lib/time";
import { AddTaskCard } from "../add-task-card";
import { Button } from "../button";
import { Decisions } from "../decisions";
import { Icon } from "../icon";
import { Outing } from "../outing";
import { TaskBlock } from "../task-block";
import { NowMarker, ThreadHop, ThreadMarker, ThreadRow } from "../thread";
import { TopBar } from "../top-bar";
import { cn } from "@/lib/cn";

type Item = { kind: "row"; block: Block } | { kind: "outing"; blocks: Block[] };

/** Sorted blocks -> top-level rows, with consecutive blocks of one outing grouped. */
export function groupBlocks(blocks: Block[]): Item[] {
  const items: Item[] = [];
  for (const b of blocks) {
    const last = items[items.length - 1];
    if (b.outingId && last?.kind === "outing" && last.blocks[0].outingId === b.outingId) last.blocks.push(b);
    else items.push(b.outingId ? { kind: "outing", blocks: [b] } : { kind: "row", block: b });
  }
  return items;
}

const itemStart = (i: Item) => toMin(i.kind === "row" ? i.block.start : i.blocks[0].start);
export const dateHeading = (d: Date): string => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export function PlanScreen(p: {
  plan: Plan; tasks: Task[]; done: string[]; moved: Moved[]; expanded: string | null; replan: Replan | null; mode: PlanMode;
  plannedAt: string; entrance: boolean; offline?: boolean; settings: Settings; presets: Preset[]; today: Date;
  onExpand: (id: string) => void; onToggleDone: (id: string) => void; onEdit: (id: string) => void; onMove: (id: string) => void;
  onBringBack: (id: string) => void; onAdd: (t: Omit<Task, "id">) => void; onReplan: (mic: boolean) => void; onNewDump: () => void; onSettings: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const byId = new Map(p.tasks.map((t) => [t.id, t]));
  const items = groupBlocks(p.plan.blocks);
  const doneSet = new Set(p.done);
  const workday = p.mode === "workday";
  const ws = toMin(p.settings.workStart), we = toMin(p.settings.workEnd);
  const nowAt = p.replan ? toMin(p.replan.at) : null;
  const doneTasks = (p.replan?.doneIds ?? []).map((id) => byId.get(id)).filter((t): t is Task => !!t);

  const lines = p.replan ? p.replan.lines : decisionsShown(p.plan);
  const total = p.plan.blocks.length;
  const headline = p.replan
    ? "Here is what I changed"
    : p.done.length > 0 ? `${p.done.length} of ${total} done` : `I made ${lines.length} ${lines.length === 1 ? "decision" : "decisions"} for you`;

  // Interleave markers (work hours, now) between top-level items by time.
  const nodes: ReactNode[] = [];
  let seq = 0;
  let wsDone = !workday, weDone = !workday, nowDone = nowAt === null;
  const firstIdx = 0, lastIdx = items.length - 1;
  const pushMarkers = (start: number) => {
    if (!wsDone && start >= ws) { wsDone = true; nodes.push(<ThreadMarker key="ws" label={`Work starts ${p.settings.workStart}`} />); }
    if (!nowDone && nowAt !== null && start >= nowAt) { nowDone = true; nodes.push(<NowMarker key="now" time={p.replan!.at} />); }
    if (!weDone && start >= we) { weDone = true; nodes.push(<ThreadMarker key="we" label={`Work ends ${p.settings.workEnd}`} />); }
  };
  const block = (b: Block, i: number, extra: { first?: boolean; last?: boolean; taut?: boolean; n?: number }) => {
    const task = byId.get(b.taskId);
    if (!task) return null;
    return (
      <ThreadRow key={b.taskId} time={b.start} where={task.location} first={extra.first} last={extra.last} taut={extra.taut} ring={extra.taut ? "outing" : "ground"} index={i} outingCount={extra.n}>
        <TaskBlock
          task={task} block={b} locked={p.offline} done={doneSet.has(b.taskId)} expanded={p.expanded === b.taskId} was={p.replan?.was[b.taskId]}
          onExpand={() => p.onExpand(b.taskId)} onToggleDone={() => p.onToggleDone(b.taskId)} onEdit={() => p.onEdit(b.taskId)} onMove={() => p.onMove(b.taskId)}
        />
      </ThreadRow>
    );
  };
  items.forEach((item, idx) => {
    pushMarkers(itemStart(item));
    if (item.kind === "row") {
      nodes.push(block(item.block, seq++, { first: idx === firstIdx, last: idx === lastIdx }));
    } else {
      const bs = item.blocks;
      const base = seq;
      const inner: ReactNode[] = [];
      bs.forEach((b, i) => {
        if (i > 0 && b.hop) inner.push(<ThreadHop key={`hop-${b.taskId}`} text={b.hop} index={seq++} />);
        inner.push(block(b, seq++, { first: i === 0, last: i === bs.length - 1, taut: true, n: base + bs.length * 2 }));
      });
      nodes.push(<Outing key={`o-${bs[0].taskId}`} summary={outingSummary(bs)} index={base}>{inner}</Outing>);
    }
  });
  pushMarkers(Infinity);

  const open = p.plan.blocks.length === 0;
  return (
    <div className="min-h-dvh pb-[168px]">
      <TopBar onSettings={p.onSettings} />
      <main>
        <div className="px-5 pt-[22px]">
          <h1 className="m-0 text-[28px] font-bold leading-8 tracking-[-0.02em]">{p.replan ? `Re-planned at ${p.replan.at}` : dateHeading(p.today)}</h1>
          <p className="m-0 mt-0.5 text-sm font-medium leading-5 text-ink-muted">
            {p.replan ? <>You said: &ldquo;{p.replan.said}&rdquo;</> : `${p.mode === "dayoff" ? "Day off" : "Workday"}. Planned at ${p.plannedAt}.`}
          </p>
        </div>
        <div aria-live="polite" className="sr-only">{p.replan ? `Re-planned. ${p.replan.lines.length} things changed.` : ""}</div>
        <div className="px-5 pb-[22px] pt-[18px]">
          {!open && <Decisions headline={headline} lines={lines} note={p.replan ? null : p.plan.note} />}
        </div>
        {doneTasks.length > 0 && (
          <div className="mb-3.5 px-5">
            <button type="button" aria-expanded={doneOpen} onClick={() => setDoneOpen((o) => !o)} className="flex min-h-11 w-full items-center gap-3 rounded-md border-0 bg-surface-soft px-4 py-3 text-left">
              <span className="grid size-6 flex-none place-items-center rounded-full bg-outside text-ink-inverse"><Icon name="check" size={13} weight={3.5} /></span>
              <span className="flex-1 text-[15px] font-medium leading-[22px] text-ink-muted">{doneTasks.length} finished: {doneTasks.map((t) => t.title).join(", ")}</span>
              <Icon name="chevron" size={16} className={cn("text-ink-muted transition-transform", doneOpen && "rotate-180")} />
            </button>
            {doneOpen && <ul className="m-0 mt-2 list-none p-0 text-[15px] leading-[22px] text-ink-muted">{doneTasks.map((t) => <li key={t.id} className="px-4 py-1 line-through">{t.title}</li>)}</ul>}
          </div>
        )}
        {open ? (
          <p className="voice m-0 px-5 py-6 text-ink-muted">Nothing left for today. Add something below, or bring back a task you moved.</p>
        ) : (
          <div className={cn("px-5", p.entrance && "enter")} data-testid="timeline">{nodes}</div>
        )}
        {p.plan.dropped.length > 0 && (
          <section aria-label="Didn't fit today" className="mx-5 mt-1 rounded-lg border border-line bg-surface p-4">
            <h2 className="m-0 mb-2 text-lg font-bold leading-6">Didn&apos;t fit today</h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {p.plan.dropped.map((d) => (
                <li key={d.taskId}>
                  <p className="m-0 font-semibold">{byId.get(d.taskId)?.title}</p>
                  <p className="voice-sm m-0 text-ink-muted">{d.why}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {p.moved.length > 0 && (
          <section aria-label="Moved to a later day" className="mx-5 mt-3.5 rounded-lg bg-surface-soft p-4">
            <h2 className="m-0 mb-1 text-lg font-bold leading-6">Moved to a later day</h2>
            <ul className="m-0 list-none p-0">
              {p.moved.map((m) => (
                <li key={m.taskId} className="flex min-h-11 items-center justify-between gap-3">
                  <span className="font-medium">{byId.get(m.taskId)?.title}<span className="text-ink-muted">, {fmtMoveDate(m.to)}</span></span>
                  <button type="button" disabled={p.offline} onClick={() => p.onBringBack(m.taskId)} className="min-h-11 rounded-pill border border-line bg-surface px-4 text-sm font-semibold">Bring back</button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-3.5 px-5">
          {adding ? (
            <AddTaskCard presets={p.presets} onAdd={(t) => { p.onAdd(t); setAdding(false); }} onCancel={() => setAdding(false)} />
          ) : (
            <button type="button" disabled={p.offline} onClick={() => setAdding(true)} className="min-h-[52px] w-full rounded-md border border-dashed border-line bg-transparent text-[15px] font-medium leading-5 text-ink-muted">+ Forgot something? Add it</button>
          )}
          <div className="mt-1 flex justify-center">
            <button type="button" disabled={p.offline} onClick={p.onNewDump} className="min-h-11 border-0 bg-transparent px-4 text-sm font-semibold text-ink-muted underline">Start a new dump</button>
          </div>
        </div>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-line bg-surface px-5 pb-7 pt-3">
        <p className="voice-sm m-0 mb-2.5 text-ink-muted">Plans change. Tell me what happened.</p>
        <div className="flex gap-2.5">
          <button type="button" aria-label="Talk to re-plan" disabled={p.offline} onClick={() => p.onReplan(true)} className="grid size-[52px] flex-none place-items-center rounded-md border border-line bg-surface-soft text-ink"><Icon name="mic" size={24} /></button>
          <div className="flex-1"><Button icon="refresh" disabled={p.offline} onClick={() => p.onReplan(false)}>Re-plan my day</Button></div>
        </div>
      </div>
    </div>
  );
}
