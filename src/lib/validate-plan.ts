/**
 * Deterministic plan checker. LLMs reason well and do arithmetic badly:
 * every plan (LLM or fallback) goes through this before it reaches the UI.
 * Returns human-readable errors; an empty array means the plan is valid.
 * On errors: re-prompt once with the list; after two failures use planDay() (src/lib/planner.ts).
 */
import type { Plan, Settings, Task } from "./schemas";
import { toMin } from "./time";

export interface ValidateContext {
  mode: "workday" | "dayoff";
  minStart?: number;
  /** Task ids whose blocks are finished and kept (exempt from the minStart check). */
  keptTaskIds?: string[];
  /** Expected duration per task when it differs from task.durationMin (e.g. "60 min left"). */
  durationOverrides?: Record<string, number>;
  /** Re-plan: "I only have 3 hours". Total minutes of scheduled non-fixed work (finished blocks excluded) may not exceed it. */
  capacityMin?: number | null;
  /** Re-plan: minutes since midnight. At most LIGHT_LIMIT_MIN of non-fixed work may start at or after it. */
  lighterAfter?: number | null;
  /** Re-plan: tasks the user must finish today. They may not be dropped. */
  mustFinishTaskIds?: string[];
}

/** The planner budgets 90 minutes after "lighter afternoon"; the checker allows a little slack. */
export const LIGHT_LIMIT_MIN = 100;

export function validatePlan(plan: Plan, tasks: Task[], s: Settings, ctx: ValidateContext): string[] {
  const errs: string[] = [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const kept = new Set(ctx.keptTaskIds ?? []);
  const wake = toMin(s.wake), sleep = toMin(s.sleep), ws = toMin(s.workStart), we = toMin(s.workEnd);
  const wd = ctx.mode === "workday";

  // coverage: every task exactly once, in blocks or dropped
  const seen = new Map<string, number>();
  plan.blocks.forEach((b) => seen.set(b.taskId, (seen.get(b.taskId) ?? 0) + 1));
  plan.dropped.forEach((d) => seen.set(d.taskId, (seen.get(d.taskId) ?? 0) + 1));
  tasks.forEach((t) => {
    const n = seen.get(t.id) ?? 0;
    if (n === 0) errs.push(`Task "${t.title}" is neither scheduled nor dropped.`);
    if (n > 1) errs.push(`Task "${t.title}" appears ${n} times.`);
  });
  seen.forEach((_, id) => { if (!byId.has(id)) errs.push(`Unknown task id ${id}.`); });

  const blocks = [...plan.blocks].sort((a, b) => toMin(a.start) - toMin(b.start));

  // durations, reasons, day bounds, min start, fixed starts, work rules
  blocks.forEach((b) => {
    const t = byId.get(b.taskId);
    if (!t) return;
    const start = toMin(b.start), end = start + b.durationMin;
    const want = ctx.durationOverrides?.[t.id] ?? t.durationMin;
    if (b.durationMin !== want && !kept.has(t.id)) errs.push(`"${t.title}" must be ${want} min, not ${b.durationMin}.`);
    if (!b.reason.trim()) errs.push(`"${t.title}" has no reason.`);
    if (start < wake || end > sleep) errs.push(`"${t.title}" (${b.start}) is outside waking hours ${s.wake} to ${s.sleep}.`);
    if (ctx.minStart != null && !kept.has(t.id) && start < ctx.minStart) errs.push(`"${t.title}" starts before the rebuild time.`);
    if (t.fixedStart && b.start !== t.fixedStart) errs.push(`"${t.title}" must start at ${t.fixedStart}, not ${b.start}.`);
    if (wd && t.location === "work" && (start < ws || end > we)) errs.push(`Work task "${t.title}" must sit inside working hours.`);
    if (wd && t.location !== "work" && !t.fixedStart) {
      const overlapsWork = start < we && end > ws;
      const lunchSized = (t.kind === "admin" || t.kind === "call") && b.durationMin <= 30;
      if (overlapsWork && !lunchSized) errs.push(`Personal task "${t.title}" (${b.start}) overlaps working hours.`);
    }
  });

  // overlaps
  for (let i = 1; i < blocks.length; i++) {
    const prevEnd = toMin(blocks[i - 1].start) + blocks[i - 1].durationMin;
    if (toMin(blocks[i].start) < prevEnd)
      errs.push(`"${byId.get(blocks[i - 1].taskId)?.title}" overlaps "${byId.get(blocks[i].taskId)?.title}".`);
  }

  // one outing: all outside tasks (that are scheduled) share it, and it is contiguous
  if (plan.outings.length > 1) errs.push("More than one outing.");
  const outside = blocks.filter((b) => byId.get(b.taskId)?.location === "outside");
  if (outside.length >= 2) {
    const ids = new Set(outside.map((b) => b.outingId));
    if (ids.size > 1 || ids.has(null)) errs.push("Outside tasks must all belong to one outing.");
  }
  const trip = blocks.filter((b) => b.outingId);
  for (let i = 1; i < trip.length; i++) {
    const gap = toMin(trip[i].start) - (toMin(trip[i - 1].start) + trip[i - 1].durationMin);
    if (gap > 15) errs.push("Outing stops must be back to back (gap over 15 min).");
    const between = blocks.filter((b) => toMin(b.start) > toMin(trip[i - 1].start) && toMin(b.start) < toMin(trip[i].start) && !b.outingId);
    if (between.length) errs.push("Something non-outing sits in the middle of the outing.");
  }

  // re-plan limits: work the user is about to do (not finished blocks, not fixed commitments)
  const flexible = blocks.filter((b) => !kept.has(b.taskId) && byId.get(b.taskId)?.kind !== "fixed");
  if (ctx.capacityMin != null) {
    const total = flexible.reduce((n, b) => n + b.durationMin, 0);
    if (total > ctx.capacityMin) errs.push(`${total} min of work is planned but the limit is ${ctx.capacityMin} min. Drop the lowest priority tasks.`);
  }
  if (ctx.lighterAfter != null) {
    const late = flexible.filter((b) => toMin(b.start) >= ctx.lighterAfter!).reduce((n, b) => n + b.durationMin, 0);
    if (late > LIGHT_LIMIT_MIN) errs.push(`${late} min of work starts after the lighter time; keep it to about 90 min.`);
  }
  plan.dropped.forEach((d) => {
    const t = byId.get(d.taskId);
    // A time the user gave is a commitment: it can only fall out of the day once that time has passed.
    if (t?.fixedStart && toMin(t.fixedStart) >= (ctx.minStart ?? 0)) errs.push(`"${t.title}" is fixed at ${t.fixedStart} and cannot be dropped.`);
    if (ctx.mustFinishTaskIds?.includes(d.taskId)) errs.push(`"${byId.get(d.taskId)?.title}" must be finished today and cannot be dropped.`);
  });

  if (plan.decisions.length > 6) errs.push("More than 6 decisions.");
  plan.dropped.forEach((d) => { if (!d.why.trim()) errs.push("A dropped task has no reason."); });
  return errs;
}
