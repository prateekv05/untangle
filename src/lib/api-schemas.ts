/** Zod input schemas for the account routes. Every route parses with one of these before touching the database. */
import { z } from "zod";
import { isIsoDate } from "../db/queries/helpers";
import { isTimezone } from "./timezone";
import { Due, HHMM, Kind, Location, Settings } from "./schemas";

export const SettingsInput = Settings.extend({
  workDays: z.array(z.number().int().min(0).max(6)).max(7).transform((d) => [...new Set(d)].sort((a, b) => a - b)),
  timezone: z.string().max(64).refine(isTimezone, "Unknown timezone"),
}).strict();
export type SettingsInput = z.infer<typeof SettingsInput>;

export const PresetBody = z
  .object({
    verb: z.string().trim().min(1).max(40),
    location: Location,
    kind: Kind.exclude(["fixed"]),
    defaultDurationMin: z.number().int().min(5).max(480).nullable(),
  })
  .strict();
export type PresetBody = z.infer<typeof PresetBody>;

export const IsoDate = z.string().refine(isIsoDate, "Expected YYYY-MM-DD");
/** Without a date the server uses today in the user's own timezone. */
export const DayQuery = z.object({ date: IsoDate.optional() }).strict();

export const UuidParam = z.string().uuid();

export const TaskPatchBody = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    location: Location.optional(),
    kind: Kind.optional(),
    durationMin: z.number().int().min(5).max(720).optional(),
    durationSource: z.enum(["user", "preset", "estimated"]).optional(),
    fixedStart: HHMM.nullable().optional(),
    due: Due.nullable().optional(),
    status: z.enum(["open", "done"]).optional(),
    /** Moves the task to a later day (status becomes "moved"). Cannot be combined with other fields. */
    moveTo: IsoDate.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Send at least one field")
  .refine((v) => v.moveTo === undefined || Object.keys(v).length === 1, "moveTo cannot be combined with other fields");
export type TaskPatchBody = z.infer<typeof TaskPatchBody>;


/** POST /api/understand. The length cap comes from MAX_DUMP_CHARS, so the route builds this schema with it. */
export const PlanForDay = z.enum(["today", "tomorrow", "dayafter"]);
export type PlanForDay = z.infer<typeof PlanForDay>;
/** `forDay` is the day the user picked on the Dump screen; without it the model's reading of the text decides. */
export const understandBody = (maxChars: number) => z.object({ text: z.string().trim().min(1).max(maxChars), forDay: PlanForDay.optional() }).strict();

/** POST /api/plan: the day and the tasks as the user left them on Understand (ids are the saved ones; new tasks have none). */
export const PlanBody = z
  .object({
    dayId: z.string().uuid(),
    /** The Workday / Day off choice on Understand; it can differ from what the date suggested. */
    mode: z.enum(["workday", "dayoff"]),
    tasks: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          title: z.string().trim().min(1).max(120),
          location: Location,
          kind: Kind,
          durationMin: z.number().int().min(5).max(480),
          durationSource: z.enum(["user", "preset", "estimated"]),
          fixedStart: HHMM.nullable(),
          due: Due.nullable(),
        }),
      )
      .min(1)
      .max(40),
  })
  .strict();
export type PlanBody = z.infer<typeof PlanBody>;

const EditableFields = z
  .object({
    title: z.string().trim().min(1).max(120),
    location: Location,
    kind: Kind,
    durationMin: z.number().int().min(5).max(480),
    durationSource: z.enum(["user", "preset", "estimated"]),
    fixedStart: HHMM.nullable(),
    due: Due.nullable(),
  })
  .strict();

/** POST /api/day/edit: one change to today's day. The server applies it, re-plans the unfinished tasks and saves the next plan version. */
export const DayEditBody = z
  .object({
    dayId: z.string().uuid(),
    op: z.discriminatedUnion("type", [
      z.object({ type: z.literal("edit"), taskId: z.string().uuid(), patch: EditableFields.partial().refine((v) => Object.keys(v).length > 0, "Send at least one field") }).strict(),
      z.object({ type: z.literal("delete"), taskId: z.string().uuid() }).strict(),
      z.object({ type: z.literal("add"), task: EditableFields }).strict(),
      z.object({ type: z.literal("move"), taskId: z.string().uuid(), to: IsoDate }).strict(),
      z.object({ type: z.literal("bringBack"), taskId: z.string().uuid() }).strict(),
    ]),
  })
  .strict();
export type DayEditBody = z.infer<typeof DayEditBody>;

/** POST /api/day/undo: put the tasks back as they were and save plan version `version` again as the newest. */
export const DayUndoBody = z
  .object({
    dayId: z.string().uuid(),
    version: z.number().int().min(1),
    tasks: z
      .array(EditableFields.extend({ id: z.string().uuid(), status: z.enum(["open", "done", "moved"]), movedTo: IsoDate.nullable() }).strict())
      .max(60),
  })
  .strict();
export type DayUndoBody = z.infer<typeof DayUndoBody>;

/** POST /api/replan: the day and what the user said changed. The length cap comes from MAX_DUMP_CHARS, as for the dump. */
export const replanBody = (maxChars: number) => z.object({ dayId: z.string().uuid(), instruction: z.string().trim().min(1).max(maxChars) }).strict();
