/**
 * Phase 1 stand-in for the "understand" call: a small keyword guesser so typed text becomes tasks
 * without a network. Pure, no I/O. Phase 4 replaces it with the AI call (docs/AI_CONTRACT.md).
 * Anything guessed here is marked durationSource "estimated" unless a preset set it.
 */
import type { Question, Task } from "./schemas";
import { HHMM } from "./schemas";
import { toHHMM } from "./time";

type Location = Task["location"];
type Kind = Task["kind"];

export interface Preset {
  id: string;
  phrase: string;
  location: Location;
  kind: Kind;
  /** null = "ask me each time". */
  durationMin: number | null;
}

export const BUILT_IN_PRESETS: Preset[] = [
  { id: "b-call", phrase: "Call", location: "anywhere", kind: "call", durationMin: 20 },
  { id: "b-goto", phrase: "Go to", location: "outside", kind: "errand", durationMin: 40 },
  { id: "b-buy", phrase: "Buy", location: "outside", kind: "errand", durationMin: 20 },
  { id: "b-order", phrase: "Order", location: "anywhere", kind: "admin", durationMin: 10 },
  { id: "b-organise", phrase: "Organise", location: "home", kind: "chore", durationMin: 30 },
  { id: "b-email", phrase: "Email", location: "anywhere", kind: "admin", durationMin: 15 },
  { id: "b-pay", phrase: "Pay", location: "anywhere", kind: "admin", durationMin: 10 },
  { id: "b-book", phrase: "Book", location: "anywhere", kind: "admin", durationMin: 10 },
  { id: "b-clean", phrase: "Clean", location: "home", kind: "chore", durationMin: 40 },
  { id: "b-workon", phrase: "Work on", location: "anywhere", kind: "deep", durationMin: 75 },
];

export const KIND_LABEL: Record<Kind, string> = {
  deep: "Focus work",
  admin: "Quick task",
  errand: "Errand",
  call: "Call",
  health: "Exercise",
  chore: "Chore",
  fixed: "Appointment",
};
export const PRESET_KINDS: Kind[] = ["deep", "admin", "errand", "call", "health", "chore"];

const FILLER = /^(?:and\s+|also\s+|then\s+|i\s+(?:really\s+)?(?:need|have|want|should|must)\s+to\s+|(?:need|have|want|got)\s+to\s+|to\s+)+/i;

/** Splits a dump into one line per thing. */
export function splitDump(text: string): string[] {
  return text
    .split(/[\n,;.]+|\s+and\s+/i)
    .map((s) => s.replace(FILLER, "").trim())
    .filter((s) => s.length >= 2);
}

export const countThings = (text: string): number => splitDump(text).length;

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "at 5pm", "at 17:00", "at 2" -> "HH:MM". A bare hour under 7 is read as afternoon. */
export function parseTime(text: string): string | null {
  const m = /\b(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(text);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h < 7) h += 12;
  const t = toHHMM(h * 60 + min);
  return HHMM.safeParse(t).success ? t : null;
}

type Guess = Pick<Task, "location" | "kind" | "durationMin" | "durationSource">;

const RULES: { re: RegExp; g: Omit<Guess, "durationSource"> }[] = [
  { re: /\b(gym|workout|run|running|yoga|swim|exercise|lift)\b/i, g: { location: "outside", kind: "health", durationMin: 60 } },
  { re: /\b(dentist|doctor|dr\.?|appointment|haircut|physio)\b/i, g: { location: "outside", kind: "fixed", durationMin: 45 } },
  { re: /\b(meeting|standup|interview)\b/i, g: { location: "work", kind: "fixed", durationMin: 60 } },
  { re: /\b(groceries|grocery|shopping|pharmacy|post office|toothpaste|buy|pick up|store|market)\b/i, g: { location: "outside", kind: "errand", durationMin: 30 } },
  { re: /\b(call|phone|ring)\b/i, g: { location: "anywhere", kind: "call", durationMin: 20 } },
  { re: /\b(email|send|reply|resume|pay|book|order|form|invoice)\b/i, g: { location: "anywhere", kind: "admin", durationMin: 15 } },
  { re: /\b(clean|laundry|dishes|cook|tidy|organise|organize)\b/i, g: { location: "home", kind: "chore", durationMin: 30 } },
  { re: /\b(assignment|homework|essay|report|study|code|coding|app|write|project|exam)\b/i, g: { location: "anywhere", kind: "deep", durationMin: 75 } },
];

/** Guess where, what kind and how long. User presets win over built-ins, built-ins over keywords. */
export function guessTask(raw: string, userPresets: Preset[] = []): Omit<Task, "id"> {
  const title = sentence(raw.trim().replace(/\s+/g, " "));
  const fixedStart = parseTime(title);
  const lower = title.toLowerCase();
  const startsWith = (p: Preset) => lower === p.phrase.toLowerCase() || lower.startsWith(`${p.phrase.toLowerCase()} `);
  const preset = [...userPresets, ...BUILT_IN_PRESETS].find(startsWith);

  let g: Guess;
  if (preset && preset.durationMin !== null && userPresets.includes(preset)) {
    g = { location: preset.location, kind: preset.kind, durationMin: preset.durationMin, durationSource: "preset" };
  } else {
    const rule = RULES.find((r) => r.re.test(title));
    const base = rule?.g ?? (preset ? { location: preset.location, kind: preset.kind, durationMin: preset.durationMin ?? 30 } : { location: "anywhere" as Location, kind: "admin" as Kind, durationMin: 30 });
    g = { ...base, durationSource: "estimated" };
  }
  const isFixed = fixedStart !== null;
  return {
    title,
    ...g,
    kind: isFixed && g.kind !== "health" ? "fixed" : g.kind,
    durationSource: isFixed ? "user" : g.durationSource,
    fixedStart,
    due: null,
  };
}

export function tasksFromText(text: string, userPresets: Preset[] = []): Task[] {
  return splitDump(text).map((line, i) => ({ id: `t${i + 1}`, ...guessTask(line, userPresets) }));
}

/** Durations only the user can know are shown in the ask colour until set. */
export const needsDuration = (t: Task): boolean =>
  t.durationSource === "estimated" && (t.kind === "health" || t.kind === "deep");

const DEADLINEY = /\b(assignment|homework|exam|report|essay|submission|application|deadline)\b/i;

/** At most 3 questions, only when the answer changes the plan. */
export function deriveQuestions(tasks: Task[]): Question[] {
  const qs: Question[] = [];
  for (const t of tasks) {
    if (t.due === null && DEADLINEY.test(t.title)) {
      qs.push({ type: "due", taskId: t.id, prompt: `When is "${t.title}" due?`, options: ["today", "tomorrow", "week", "none"] });
    }
  }
  for (const t of tasks) {
    if (t.kind === "health" && needsDuration(t)) {
      qs.push({ type: "duration", taskId: t.id, prompt: `How long is your ${t.title.toLowerCase()} session?`, optionsMin: [45, 60, 90] });
    }
  }
  return qs.slice(0, 3);
}
