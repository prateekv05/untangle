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
export const DayQuery = z.object({ date: IsoDate }).strict();

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
