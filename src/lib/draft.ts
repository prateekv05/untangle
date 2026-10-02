/**
 * The unfinished list: what the user typed or said on Dump, or what they were fixing on Understand.
 * Saved to the account as they go (one draft per user) so closing the app loses nothing. Pure: no I/O.
 */
import { z } from "zod";
import { Question, Task, UnderstandResult } from "./schemas";

export const DRAFT_MAX_AGE_DAYS = 7;

export const DraftPayload = z
  .object({
    screen: z.enum(["dump", "understand"]),
    text: z.string().max(4000),
    mode: z.enum(["workday", "dayoff"]),
    /** The saved day the Understand tasks belong to; null on Dump. */
    dayId: z.string().uuid().nullable(),
    tasks: z.array(Task).max(40),
    questions: z.array(Question).max(3),
    groupings: UnderstandResult.shape.groupings.max(10),
  })
  .strict();
export type DraftPayload = z.infer<typeof DraftPayload>;

type DraftSource = { screen: string; text: string; mode: DraftPayload["mode"]; tasks: Task[]; questions: Question[]; groupings: DraftPayload["groupings"] };

/**
 * What to save for the screen showing now: a draft, null to clear it (nothing left worth keeping),
 * or undefined to leave it alone (Listening, Thinking and Plan do not own the draft).
 */
export function draftFrom(s: DraftSource, dayId: string | null): DraftPayload | null | undefined {
  if (s.screen === "dump") {
    return s.text.trim() ? { screen: "dump", text: s.text, mode: s.mode, dayId: null, tasks: [], questions: [], groupings: [] } : null;
  }
  if (s.screen === "understand") {
    return s.tasks.length > 0 ? { screen: "understand", text: s.text, mode: s.mode, dayId, tasks: s.tasks, questions: s.questions, groupings: s.groupings } : null;
  }
  return undefined;
}

/** Local task ids are "n1", "n2"…: the next free number, so a restored list never reuses one. */
export function nextLocalId(tasks: Task[]): number {
  const used = tasks.map((t) => /^n(\d+)$/.exec(t.id)).flatMap((m) => (m ? [Number(m[1])] : []));
  return Math.max(tasks.length, ...used) + 1;
}
