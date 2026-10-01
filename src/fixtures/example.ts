/** Fixture data for Phase 1. The tasks mirror the example in src/lib/__tests__/planner.test.ts. */
import type { Task } from "../lib/schemas";

const T = (id: string, title: string, location: Task["location"], kind: Task["kind"], durationMin: number, x: Partial<Task> = {}): Task =>
  ({ id, title, location, kind, durationMin, durationSource: "estimated", fixedStart: null, due: null, ...x });

export const EXAMPLE_DUMP = "SQL assignment, gym, groceries, call Mom, send resume to Sarah, work on my app, buy toothpaste";
export const APPOINTMENT_DUMP = `${EXAMPLE_DUMP}, dentist at 5pm`;

/** What the "understand" call would return for the example dump (before the user answers anything). */
export const exampleTasks = (): Task[] => [
  T("sql", "Finish SQL assignment", "anywhere", "deep", 90),
  T("groc", "Grocery shopping", "outside", "errand", 40),
  T("mom", "Call mom", "anywhere", "call", 20),
  T("gym", "Gym", "outside", "health", 60),
  T("res", "Send resume to Sarah", "anywhere", "admin", 15),
  T("app", "Work on app", "anywhere", "deep", 75),
  T("tp", "Buy toothpaste", "outside", "errand", 15),
];

export const appointmentTasks = (): Task[] => [
  ...exampleTasks(),
  T("dent", "Dentist at 5pm", "outside", "fixed", 45, { fixedStart: "17:00", durationSource: "user" }),
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
/** The two demo dumps resolve to the rich fixture tasks; anything else goes through guessTask(). */
export function fixtureTasksFor(text: string): Task[] | null {
  if (norm(text) === norm(EXAMPLE_DUMP)) return exampleTasks();
  if (norm(text) === norm(APPOINTMENT_DUMP)) return appointmentTasks();
  return null;
}

export const MOCK_TRANSCRIPT = {
  said: "Okay, tomorrow I need to finish my SQL assignment, I have to go grocery shopping, I need to call my mom, I want to go to the gym, I need to send Sarah my resume, and ",
  newest: "I really need to spend some time on my app",
  planningFor: "Planning for tomorrow, Friday",
  heard: ["SQL assignment", "Grocery shopping", "Call mom", "Gym", "Send resume to Sarah", "Work on app"],
  full: `${EXAMPLE_DUMP}.`,
};
