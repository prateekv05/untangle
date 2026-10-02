/** Wording for the Past days screens. Pure: no I/O. */
import type { HistoryItem } from "../db/queries/history";
import { addDays } from "./timezone";

/** "Tuesday, October 6" for an ISO date. */
export const historyDate = (iso: string): string =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

const things = (n: number) => (n === 1 ? "1 task" : `${n} tasks`);

/** "Workday. 5 of 7 done." — and what moved on, when something did. */
export function historySummary(d: Pick<HistoryItem, "mode" | "total" | "done" | "moved">): string {
  const kind = d.mode === "dayoff" ? "Day off" : "Workday";
  const done = d.total === 0 ? "No tasks" : d.done === 0 ? things(d.total) : `${d.done} of ${d.total} done`;
  const moved = d.moved > 0 ? `, ${d.moved} moved on` : "";
  return `${kind}. ${done}${moved}.`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAY_LETTERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** The seven ISO dates of the Monday-to-Sunday week that holds `iso`. */
export function weekOf(iso: string): string[] {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const monday = addDays(iso, -((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** "Sep 28 - Oct 4" for a week of seven dates. */
export function weekLabel(week: string[]): string {
  const part = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
  return `${part(week[0])} - ${part(week[6])}`;
}
