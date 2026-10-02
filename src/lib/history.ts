/** Wording for the Past days screens. Pure: no I/O. */
import type { HistoryItem } from "../db/queries/history";

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
