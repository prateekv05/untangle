/**
 * Pure rules for changing a day that already has a plan: which change is allowed, which blocks stay put,
 * and where "Move later" lands. No I/O, so the routes and the screen share them.
 */
import { InputError } from "../db/queries/helpers";
import type { DayEditBody } from "./api-schemas";
import { addDays } from "./timezone";
import type { Block, Plan, Task } from "./schemas";

export type DayRow = Task & { status: "open" | "done" | "moved" | "deleted"; movedTo: string | null };
type Op = DayEditBody["op"];

/** The planner's view of a saved task: no status, no move date. */
export const toTask = (r: Task): Task => ({ id: r.id, title: r.title, location: r.location, kind: r.kind, durationMin: r.durationMin, durationSource: r.durationSource, fixedStart: r.fixedStart, due: r.due });

/** Tasks that belong in the plan: open and finished. Moved and deleted ones are out. */
export const activeTasks = (rows: DayRow[]): Task[] => rows.filter((r) => r.status === "open" || r.status === "done").map(toTask);

/** Finished tasks keep their blocks exactly where the current plan has them. */
export const keptBlocksFor = (plan: Plan | null, rows: DayRow[]): Block[] => {
  const done = new Set(rows.filter((r) => r.status === "done").map((r) => r.id));
  return (plan?.blocks ?? []).filter((b) => done.has(b.taskId));
};

/** Throws InputError when the change makes no sense for the day as it stands. */
export function checkOp(rows: DayRow[], op: Op): void {
  if (op.type === "add") return;
  const row = rows.find((r) => r.id === op.taskId);
  if (!row || row.status === "deleted") throw new InputError("That task is not on this day");
  if (op.type === "bringBack") {
    if (row.status !== "moved") throw new InputError("That task was not moved");
  } else if (row.status === "moved") {
    throw new InputError("That task is on another day");
  } else if (op.type === "edit" && row.status === "done") {
    throw new InputError("A finished task stays as it is");
  }
}

/** "Tomorrow", a weekday name (the next one after tomorrow), or "Next week" (the coming Monday after this week) to an ISO date. */
export function resolveMoveTarget(label: string, today: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;
  if (label === "Tomorrow") return addDays(today, 1);
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  if (label === "Next week") return addDays(today, ((8 - dow) % 7) || 7);
  const want = names.indexOf(label);
  if (want < 0) throw new InputError(`Unknown day "${label}"`);
  const offset = (want - dow + 7) % 7 || 7;
  return addDays(today, offset === 1 ? 8 : offset); // tomorrow has its own label
}
