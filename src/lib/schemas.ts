import { z } from "zod";

/** Colour means WHERE (see design/DESIGN_SYSTEM.md). */
export const Location = z.enum(["home", "work", "outside", "anywhere"]);
export const Kind = z.enum(["deep", "admin", "errand", "call", "health", "chore", "fixed"]);
export const Due = z.enum(["today", "tomorrow", "week", "none"]);
export const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM, 24-hour");

export const Settings = z.object({
  workStart: HHMM,
  workEnd: HHMM,
  workDays: z.array(z.number().int().min(0).max(6)), // 0 = Sunday
  wake: HHMM,
  sleep: HHMM,
  timezone: z.string(),
});
export type Settings = z.infer<typeof Settings>;
export const DEFAULT_SETTINGS: Settings = {
  workStart: "09:00",
  workEnd: "17:00",
  workDays: [1, 2, 3, 4, 5],
  wake: "07:00",
  sleep: "23:00",
  timezone: "UTC",
};

export const Task = z.object({
  id: z.string(),
  title: z.string().min(1).max(120),
  location: Location,
  kind: Kind,
  durationMin: z.number().int().min(5).max(480),
  /** "estimated" = Untangle guessed. Never guess durations only the user can know (workouts, focus work): ask. */
  durationSource: z.enum(["user", "preset", "estimated"]),
  fixedStart: HHMM.nullable(), // a time the user gave, e.g. "dentist at 5pm" -> "17:00"
  due: Due.nullable(), // null = unknown (maybe ask), "none" = user said no deadline
});
export type Task = z.infer<typeof Task>;

export const Question = z.discriminatedUnion("type", [
  z.object({ type: z.literal("due"), taskId: z.string(), prompt: z.string(), options: z.array(Due) }),
  z.object({ type: z.literal("duration"), taskId: z.string(), prompt: z.string(), optionsMin: z.array(z.number().int()) }),
  z.object({ type: z.literal("time"), taskId: z.string(), prompt: z.string() }),
]);
export type Question = z.infer<typeof Question>;

/** Output of the "understand" call. */
export const UnderstandResult = z.object({
  planFor: z.enum(["today", "tomorrow"]),
  tasks: z.array(Task).min(1),
  /** Only questions whose answer changes the plan. Max 3. */
  questions: z.array(Question).max(3),
  /** Things that belong together, shown on the Understand screen. */
  groupings: z.array(z.object({ label: z.string(), taskIds: z.array(z.string()).min(2), why: z.string() })),
});
export type UnderstandResult = z.infer<typeof UnderstandResult>;

export const Block = z.object({
  taskId: z.string(),
  start: HHMM,
  durationMin: z.number().int().min(5),
  outingId: z.string().nullable(),
  /** One sentence, first person, plain. Shown in the serif "voice". */
  reason: z.string().min(1).max(200),
  /** Text between outing stops: "on the way back", "next stop", "right after your dentist". */
  hop: z.string().nullable(),
});
export type Block = z.infer<typeof Block>;

export const Plan = z.object({
  blocks: z.array(Block),
  outings: z.array(z.object({ id: z.string(), label: z.string() })).max(1),
  /** "I made N decisions for you" lines. Max 6. */
  decisions: z.array(z.string()).max(6),
  dropped: z.array(z.object({ taskId: z.string(), why: z.string() })),
  /** e.g. "I guessed the time for gym (60 min). Set your own and I will re-plan." */
  note: z.string().nullable(),
});
export type Plan = z.infer<typeof Plan>;

/** Output of the "interpret re-plan" call: free text -> hard constraints for the planner. */
export const ReplanConstraints = z.object({
  now: HHMM,
  doneTaskIds: z.array(z.string()),
  /** Tasks the user says they did not finish; remainingMin if they said how much is left. */
  unfinished: z.array(z.object({ taskId: z.string(), remainingMin: z.number().int().nullable() })),
  newEvents: z.array(z.object({ title: z.string(), start: HHMM, durationMin: z.number().int(), location: Location })),
  /** "I only have 3 hours" -> 180. */
  capacityMin: z.number().int().nullable(),
  /** "lighter afternoon" -> "12:00": after this time, schedule at most ~90 min of non-fixed work. */
  lighterAfter: HHMM.nullable(),
  mustFinishTaskIds: z.array(z.string()),
  dropTaskIds: z.array(z.string()),
  delayMin: z.number().int().nullable(), // "running 90 minutes late"
});
export type ReplanConstraints = z.infer<typeof ReplanConstraints>;
