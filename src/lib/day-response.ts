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
