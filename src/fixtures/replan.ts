/**
 * Phase 1 stand-in for the "interpret re-plan" AI call (docs/AI_CONTRACT.md): keyword rules that turn the
 * chip sentences and simple free text into ReplanConstraints. Returns null when nothing was understood,
 * which shows the "I couldn't rebuild that" toast. Replaced in Phase 7.
 */
import { parseTime } from "../lib/guess";
import type { ReplanConstraints, Task } from "../lib/schemas";
import { toHHMM } from "../lib/time";

const STOP = new Set(["the", "and", "my", "to", "on", "of", "a", "for", "finish", "work", "send", "call", "buy", "go", "get", "do"]);
const words = (s: string) => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];

/** Tasks the text points at, by any distinctive word of the title. */
export function mentionedTasks(text: string, tasks: Task[]): Task[] {
  const said = new Set(words(text));
  return tasks.filter((t) => words(t.title).some((w) => w.length >= 3 && !STOP.has(w) && said.has(w)));
}

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, an: 1, a: 1, half: 0.5 };
const amount = (s: string): number | null => (/^\d+(\.\d+)?$/.test(s) ? Number(s) : NUM[s] ?? null);

export function interpretReplan(text: string, openTasks: Task[], nowMin: number): ReplanConstraints | null {
  const t = text.toLowerCase();
  const c: ReplanConstraints = {
    now: toHHMM(nowMin), doneTaskIds: [], unfinished: [], newEvents: [], capacityMin: null, lighterAfter: null,
    mustFinishTaskIds: [], dropTaskIds: [], delayMin: null,
  };
  let understood = false;

  const unf = /(?:didn'?t|did not|haven'?t|have not|not)\s+(?:yet\s+)?finish(?:ed)?\s+([^,.;]*?)(?=\s+and\b|[,.;]|$)/.exec(t);
  if (unf) {
    mentionedTasks(unf[1], openTasks).forEach((m) => c.unfinished.push({ taskId: m.id, remainingMin: null }));
    understood = understood || c.unfinished.length > 0;
  }
  const must = /must\s+finish\s+([^,.;]*?)(?=\s+today|\s+and\b|[,.;]|$)/.exec(t);
  if (must) {
    c.mustFinishTaskIds = mentionedTasks(must[1], openTasks).map((m) => m.id);
    understood = understood || c.mustFinishTaskIds.length > 0;
  }
  const late = /(\d+(?:\.\d+)?|an|a|half an?|one|two)\s*(minutes?|mins?|hours?|hrs?|h)\s+(?:late|behind)|(?:late|behind)\s+by\s+(\d+)\s*(minutes?|mins?|hours?|h)/.exec(t);
  if (late) {
    const raw = (late[1] ?? late[3]).replace(/^half an?$/, "half");
    const unit = late[2] ?? late[4];
    const n = amount(raw);
    if (n !== null) { c.delayMin = Math.round(n * (unit.startsWith("h") ? 60 : 1)); understood = true; }
  } else if (/running (?:late|behind)/.test(t)) { c.delayMin = 30; understood = true; }
  if (/lighter (?:afternoon|day)|take it easy/.test(t)) { c.lighterAfter = toHHMM(Math.max(12 * 60, nowMin)); understood = true; }
  const only = /only\s+(?:have\s+)?(\d+(?:\.\d+)?|one|two|three|four|five|six)\s*(hours?|hrs?|h|minutes?|mins?)/.exec(t);
  if (only) {
    const n = amount(only[1]);
    if (n !== null) { c.capacityMin = Math.round(n * (only[2].startsWith("h") ? 60 : 1)); understood = true; }
  }
  const drop = /(?:drop|skip|forget|cancel)\s+([^,.;]*?)(?=\s+and\b|[,.;]|$)/.exec(t);
  if (drop) {
    c.dropTaskIds = mentionedTasks(drop[1], openTasks).map((m) => m.id);
    understood = understood || c.dropTaskIds.length > 0;
  }
  const ev = /(?:i have|i've got|there'?s|got)\s+(?:a|an)\s+([a-z ]+?)\s+(at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/.exec(t);
  if (ev) {
    const start = parseTime(ev[2]);
    if (start) {
      const title = ev[1].trim();
      const location: Task["location"] = /meeting|standup|interview|call/.test(title) ? "work" : /dentist|doctor|appointment/.test(title) ? "outside" : "anywhere";
      c.newEvents.push({ title: title.charAt(0).toUpperCase() + title.slice(1), start, durationMin: location === "work" ? 60 : 45, location });
      understood = true;
    }
  }
  return understood ? c : null;
}

/** Chip sentences. Chips that need a target are completed with the picked task or amount. */
export const REPLAN_CHIPS: { id: string; label: string; needs: "task" | "delay" | null; sentence: (x: string) => string }[] = [
  { id: "unfinished", label: "I didn't finish something", needs: "task", sentence: (x: string) => `I didn't finish ${x}.` },
  { id: "late", label: "Running late", needs: "delay", sentence: (x: string) => `I'm running ${x} late.` },
  { id: "light", label: "Lighter afternoon", needs: null, sentence: () => "Make it a lighter afternoon." },
  { id: "three", label: "Only 3 hours left", needs: null, sentence: () => "I only have 3 hours left." },
  { id: "must", label: "I must finish the app today", needs: null, sentence: () => "I must finish the app today." },
];
export const DELAY_OPTIONS = ["30 minutes", "1 hour", "90 minutes", "2 hours"];
