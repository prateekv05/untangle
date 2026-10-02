/** What the edit and undo routes return, and what the day route returns for a saved day. */
import type { Plan } from "./schemas";
import type { DayTask } from "../db/queries";

export type DayView = {
  dayId: string;
  mode: "workday" | "dayoff";
  /** Open, finished and moved tasks (never deleted ones). */
  tasks: DayTask[];
  plan: Plan;
  version: number;
  source: "llm" | "fallback";
  model: string | null;
  plannedAt: string;
};

/** What POST /api/replan returns: the new day plus what changed, for the "Here is what I changed" card and the was-pills. */
export type ReplanView = DayView & {
  changes: {
    /** HH:MM the day was rebuilt at. */
    at: string;
    /** Previous start per task id. */
    was: Record<string, string>;
    /** "Here is what I changed", one line each. */
    lines: string[];
  };
};
