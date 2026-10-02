/**
 * Pure re-plan rules (docs/AI_CONTRACT.md 3b): turn the interpreted sentence into the changes to save and the
 * options the plan step must honour. No I/O, so the route and the evals share it.
 */
import type { DayRow } from "./day-edit";
import type { Plan, ReplanConstraints, Task } from "./schemas";
import { toHHMM, toMin } from "./time";

/** What a re-plan must hold to, in the units the planner and validator use (minutes since midnight). */
export type ReplanLimits = {
  capacityMin: number | null;
  lighterAfter: number | null;
  mustFinishTaskIds: string[];
  durationOverrides: Record<string, number>;
};

export const NO_LIMITS: ReplanLimits = { capacityMin: null, lighterAfter: null, mustFinishTaskIds: [], durationOverrides: {} };

/** The changes to save before planning, plus the limits for the plan step. Ids are checked against the day. */
export type ReplanChanges = {
  /** Open tasks the sentence says are finished. */
  markDone: string[];
  /** Finished tasks the sentence says were not: they go back to open. */
  reopen: string[];
  /** Tasks to move to tomorrow. */
  drop: string[];
  /** New commitments, saved as tasks with kind "fixed". */
  newEvents: Omit<Task, "id">[];
  limits: ReplanLimits;
  /** Nothing new may start before this (minutes). */
  minStart: number;
};

const round5 = (n: number) => Math.ceil(n / 5) * 5;
/** Largest duration a saved task can have. */
const MAX_DURATION = 480;

/**
 * Checks the model's constraints against the day and works out what to change.
 * Unknown ids and nonsense numbers are dropped, never guessed at.
 */
export function planReplanChanges(c: ReplanConstraints, rows: DayRow[], plan: Plan | null, nowMin: number): ReplanChanges {
  const byId = new Map(rows.filter((r) => r.status === "open" || r.status === "done").map((r) => [r.id, r]));
  const known = (ids: string[]) => [...new Set(ids)].filter((id) => byId.has(id));
  const blockOf = (id: string) => plan?.blocks.find((b) => b.taskId === id);

  const reopen = known(c.unfinished.map((u) => u.taskId)).filter((id) => byId.get(id)!.status === "done");
  const reopenSet = new Set(reopen);
  const markDone = known(c.doneTaskIds).filter((id) => byId.get(id)!.status === "open" && !c.unfinished.some((u) => u.taskId === id));
  const doneSet = new Set(markDone);
  const drop = known(c.dropTaskIds).filter((id) => byId.get(id)!.status === "open" && !doneSet.has(id));
  const dropSet = new Set(drop);

  // "I didn't finish X": what is left is what they said, else half of it. A task still to come in the plan has not been started.
  const durationOverrides: Record<string, number> = {};
  for (const u of c.unfinished) {
    const row = byId.get(u.taskId);
    if (!row || dropSet.has(u.taskId)) continue;
    const started = reopenSet.has(u.taskId) || (blockOf(u.taskId) && toMin(blockOf(u.taskId)!.start) < nowMin);
    if (!started) continue;
    const left = u.remainingMin && u.remainingMin > 0 ? u.remainingMin : Math.ceil(row.durationMin / 2);
    durationOverrides[u.taskId] = Math.min(row.durationMin, Math.max(5, round5(left)));
  }

  const newEvents = c.newEvents.map((e): Omit<Task, "id"> => ({
    title: e.title.trim().slice(0, 120) || "Event",
    location: e.location,
    kind: "fixed",
    durationMin: Math.min(MAX_DURATION, Math.max(5, Math.round(e.durationMin))),
    durationSource: "user",
    fixedStart: e.start,
    due: null,
  }));

  const delay = c.delayMin && c.delayMin > 0 ? c.delayMin : 0;
  // Running late pushes the rebuild past the next thing that was still to come, not just past now.
  const upcoming = (plan?.blocks ?? []).filter((b) => !doneSet.has(b.taskId) && byId.get(b.taskId)?.status === "open" && !dropSet.has(b.taskId) && toMin(b.start) >= nowMin).map((b) => toMin(b.start));
  const nextStart = upcoming.length ? Math.min(...upcoming) : nowMin;
  const minStart = round5(delay ? Math.max(nowMin, nextStart + delay) : nowMin);

  return {
    markDone,
    reopen,
    drop,
    newEvents,
    minStart,
    limits: {
      capacityMin: c.capacityMin && c.capacityMin > 0 ? c.capacityMin : null,
      lighterAfter: c.lighterAfter ? toMin(c.lighterAfter) : null,
      mustFinishTaskIds: known(c.mustFinishTaskIds).filter((id) => !dropSet.has(id)),
      durationOverrides,
    },
  };
}

const fmtMin = (n: number) => (n % 60 === 0 ? `${n / 60} h` : n > 60 ? `${Math.floor(n / 60)} h ${n % 60} min` : `${n} min`);

/**
 * "Here is what I changed": one first-person line per real change, written from the old and new plans (not by the model),
 * so every line is true. At most 6.
 */
export function changeLines(prev: Plan | null, next: Plan, titles: Map<string, string>, was: Record<string, string>, limits: ReplanLimits, newEventIds: string[], movedIds: string[] = []): string[] {
  const name = (id: string) => titles.get(id) ?? "That task";
  const lines: string[] = [];
  for (const id of newEventIds) {
    const b = next.blocks.find((x) => x.taskId === id);
    if (b) lines.push(`${name(id)} is in at ${b.start}, and the rest works around it`);
  }
  for (const id of movedIds) lines.push(`${name(id)} moves to tomorrow`);
  for (const [id, mins] of Object.entries(limits.durationOverrides)) lines.push(`${name(id)} gets ${fmtMin(mins)}, what is left of it`);
  if (limits.capacityMin) lines.push(`Planned for your ${fmtMin(limits.capacityMin)}, highest priority first`);
  if (limits.lighterAfter != null) lines.push(`Kept the time after ${toHHMM(limits.lighterAfter)} light`);
  const before = new Set((prev?.dropped ?? []).map((d) => d.taskId));
  for (const d of next.dropped) if (!before.has(d.taskId)) lines.push(`${name(d.taskId)} waits for another day`);
  const moved = Object.keys(was).filter((id) => !newEventIds.includes(id) && !(id in limits.durationOverrides));
  if (moved.length) lines.push(moved.length === 1 ? `${name(moved[0])} moved from ${was[moved[0]]}` : `${moved.length} other tasks moved to fit`);
  return lines.slice(0, 6);
}

/** The day's rows after the changes are saved, without a database: used by the evals. `newIds` name the new events in order. */
export function applyReplanChanges(rows: DayRow[], c: ReplanChanges, newIds: string[], tomorrow: string): DayRow[] {
  const next = rows.map((r): DayRow => {
    if (c.reopen.includes(r.id)) return { ...r, status: "open" };
    if (c.markDone.includes(r.id)) return { ...r, status: "done" };
    if (c.drop.includes(r.id)) return { ...r, status: "moved", movedTo: tomorrow };
    return r;
  });
  return [...next, ...c.newEvents.map((e, i): DayRow => ({ ...e, id: newIds[i], status: "open", movedTo: null }))];
}
