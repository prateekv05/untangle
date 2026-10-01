import type { Task } from "../../lib/schemas";
import type { tasks } from "../schema";

type TaskRow = typeof tasks.$inferSelect;

export class AiLimitError extends Error {
  constructor(public readonly limit: number) {
    super(`Daily AI call limit of ${limit} reached`);
    this.name = "AiLimitError";
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

/** Bad input that got past the route's schema (for example a move target that is not later). Becomes a 400. */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function assertIsoDate(value: string): void {
  if (!isIsoDate(value)) throw new InputError(`Expected YYYY-MM-DD, got "${value}"`);
}

/** A task can only be moved to a later day than the one it is on. ISO dates compare as strings. */
export function assertMoveTarget(fromDate: string, toDate: string): void {
  assertIsoDate(toDate);
  if (toDate <= fromDate) throw new InputError("A task can only be moved to a later day");
}

/** Database row to the domain Task used by the planner and the UI. */
export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    kind: row.kind,
    durationMin: row.durationMin,
    durationSource: row.durationSource,
    fixedStart: row.fixedStart,
    due: row.due,
  };
}

export type TaskPatch = Partial<Pick<Task, "title" | "location" | "kind" | "durationMin" | "durationSource" | "fixedStart" | "due">> & {
  status?: "open" | "done";
};

/** Drop undefined keys so a patch never overwrites a column with null by accident. */
export function cleanPatch<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export const GENDERS = ["woman", "man", "non_binary", "prefer_not_to_say"] as const;
export type Gender = (typeof GENDERS)[number];

/** Emails are compared case-insensitively; store and look up the lowercase form. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Start of the fixed rate-limit window that contains `now`. */
export function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}
