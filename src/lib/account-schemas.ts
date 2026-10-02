import { z } from "zod";
import { GENDERS } from "../db/queries/helpers";
import { MIN_PASSWORD_LENGTH } from "./password-rules";
import { isTimezone } from "./timezone";

export const Gender = z.enum(GENDERS);

export const MeUpdate = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    gender: Gender.nullable().optional(),
    /** The device's IANA zone, saved to the account's settings. Sent when onboarding finishes. */
    timezone: z.string().max(64).refine(isTimezone, "Unknown timezone").optional(),
    /** Finishes onboarding (sets onboarded_at). Needs a name to be saved already or sent with it. */
    complete: z.literal(true).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Send at least one field");
export type MeUpdate = z.infer<typeof MeUpdate>;

export const PasswordUpdate = z.object({ password: z.string().min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`).max(200) }).strict();
export type PasswordUpdate = z.infer<typeof PasswordUpdate>;
