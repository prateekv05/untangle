/**
 * The Phase 1 client state machine: which screen is showing, the tasks, the plan and its undo history.
 * Pure (no I/O, no clock): callers pass `now` in minutes. Plans come from planDay(), so every plan
 * shown is a real valid plan even though nothing here talks to a backend.
 */
import type { Preset } from "./guess";
import { diffStarts, planDay, type PlanMode, type PlanOptions } from "./planner";
import { DEFAULT_SETTINGS, type Block, type Plan, type Question, type ReplanConstraints, type Settings, type Task, type UnderstandResult } from "./schemas";
import { toTask } from "./day-edit";
import type { DayView } from "./day-response";
import { fmtDuration, toHHMM, toMin } from "./time";

export type Screen = "dump" | "listening" | "thinking" | "understand" | "plan";
export type ThinkingKind = "dump" | "plan";
export type SheetState =
  | null
  | { type: "edit"; taskId: string }
  | { type: "move"; taskId: string }
  | { type: "replan" }
  | { type: "newdump" }
  | { type: "settings" }
  | { type: "presets" }
  | { type: "password" };

export type Grouping = UnderstandResult["groupings"][number];
/** `to` is the ISO date the task was moved to. */
export interface Moved { taskId: string; to: string }
export interface Replan {
  at: string;
  said: string;
  /** Previous start per task, for the "was 09:00" pills. */
  was: Record<string, string>;
  doneIds: string[];
  lines: string[];
}
export interface ToastState { id: number; text: string; undo: boolean; ms: number }
interface Snapshot { plan: Plan | null; tasks: Task[]; moved: Moved[]; done: string[]; replan: Replan | null; version: number }

export interface FlowState {
  screen: Screen;
  thinking: ThinkingKind;
  /** Where the thinking screen came from; Understand's "Edit my list" goes back to Dump. */
  text: string;
  tasks: Task[];
  questions: Question[];
  /** What belongs together, as the model saw it. Shown on Understand. */
  groupings: Grouping[];
  mode: PlanMode;
  settings: Settings;
  presets: Preset[];
  plan: Plan | null;
  plannedAt: string;
  done: string[];
  moved: Moved[];
  expanded: string | null;
  sheet: SheetState;
  replan: Replan | null;
  /** True only for the first render of a freshly built plan, so the entrance animation plays once. */
  entrance: boolean;
  undo: Snapshot | null;
  toast: ToastState | null;
  carried: string[];
  nextId: number;
  /** The saved day and the plan version on screen; set once the plan is saved. */
  dayId: string | null;
  version: number;
}

export const initialState = (text = ""): FlowState => ({
  screen: "dump",
  thinking: "dump",
  text,
  tasks: [],
  questions: [],
  groupings: [],
  mode: "workday",
  settings: DEFAULT_SETTINGS,
  presets: [],
  plan: null,
  plannedAt: "08:30",
  done: [],
  moved: [],
  expanded: null,
  sheet: null,
  replan: null,
  entrance: false,
  undo: null,
  toast: null,
  carried: [],
  nextId: 1,
  dayId: null,
  version: 0,
});

export type Action =
  | { type: "text"; text: string }
  | { type: "screen"; screen: Screen }
  | { type: "think"; kind: ThinkingKind }
  | { type: "understood"; tasks: Task[]; questions: Question[]; mode: PlanMode; groupings?: Grouping[] }
  | { type: "answer"; question: Question; value: string | number | null }
  | { type: "patchTask"; taskId: string; patch: Partial<Task>; now: number }
  | { type: "removeTask"; taskId: string; now: number }
  | { type: "addTask"; task: Omit<Task, "id">; now: number }
  | { type: "mode"; mode: PlanMode }
  | { type: "build"; now: number }
  /** A validated plan from /api/plan: reveal it with the entrance animation. Tasks carry their saved ids. */
  | { type: "planned"; dayId: string; version: number; plan: Plan; tasks: Task[]; mode: PlanMode; plannedAt: string }
  /** Today's saved day, put back on screen when the app opens. */
  | { type: "loaded"; view: DayView }
  /** A saved change and its re-plan from /api/day/edit: swap everything in place and offer Undo. */
  | { type: "mutated"; view: DayView; toast: string; ms?: number }
  /** A saved undo from /api/day/undo. */
  | { type: "undone"; view: DayView }
  | { type: "toggleDone"; taskId: string }
  | { type: "expand"; taskId: string | null }
  | { type: "applyReplan"; constraints: ReplanConstraints; said: string; now: number }
  | { type: "undo" }
  | { type: "sheet"; sheet: SheetState }
  | { type: "toast"; text: string | null; undo?: boolean; ms?: number }
  | { type: "settings"; settings: Settings }
  | { type: "presets"; presets: Preset[] }
  /** Optimistic preset edits: add (replacing the same phrase), swap the temporary id for the saved one, drop, put back. */
  | { type: "presetAdd"; preset: Preset }
  | { type: "presetSaved"; tempId: string; preset: Preset }
  | { type: "presetDrop"; id: string }
  | { type: "presetRestore"; preset: Preset }
  | { type: "reset" };

const SNAP = (s: FlowState): Snapshot => ({ plan: s.plan, tasks: s.tasks, moved: s.moved, done: s.done, replan: s.replan, version: s.version });

/** A saved day as screen state: tasks without their status, finished ids, and where moved tasks went. */
function fromView(view: DayView) {
  const tasks = view.tasks.map(toTask);
  return {
    dayId: view.dayId, version: view.version, plan: view.plan, tasks, mode: view.mode, plannedAt: view.plannedAt,
    done: view.tasks.filter((t) => t.status === "done").map((t) => t.id),
    moved: view.tasks.flatMap((t): Moved[] => (t.status === "moved" && t.movedTo ? [{ taskId: t.id, to: t.movedTo }] : [])),
  };
}
const round5 = (n: number) => Math.ceil(n / 5) * 5;

/** Plan the tasks that are still open. Finished blocks stay exactly where they are. */
export function buildPlan(s: Pick<FlowState, "tasks" | "moved" | "done" | "plan" | "settings" | "mode">, now: number, extra: Partial<PlanOptions> = {}, tasks: Task[] = s.tasks): Plan {
  const movedIds = new Set(s.moved.map((m) => m.taskId));
  const active = tasks.filter((t) => !movedIds.has(t.id));
  const activeIds = new Set(active.map((t) => t.id));
  const doneSet = new Set(s.done);
  const fixedBlocks = (s.plan?.blocks ?? []).filter((b) => doneSet.has(b.taskId) && activeIds.has(b.taskId));
  const underway = fixedBlocks.length > 0 || extra.minStart != null;
  const minStart = Math.max(extra.minStart ?? 0, underway ? round5(now) : 0);
  return planDay(active, s.settings, { ...extra, mode: s.mode, fixedBlocks, minStart: minStart || undefined });
}

const withPlan = (s: FlowState, now: number, patch: Partial<FlowState>): FlowState => {
  const next = { ...s, ...patch, entrance: false };
  return { ...next, plan: buildPlan(next, now), replan: null };
};

const bumpToast = (s: FlowState, text: string, undo: boolean, ms: number): ToastState => ({ id: (s.toast?.id ?? 0) + 1, text, undo, ms });

export function reducer(s: FlowState, a: Action): FlowState {
  switch (a.type) {
    case "text":
      return { ...s, text: a.text };
    case "screen":
      return { ...s, screen: a.screen, sheet: null, expanded: null };
    case "think":
      return { ...s, screen: "thinking", thinking: a.kind, sheet: null };
    case "understood":
      return { ...s, screen: "understand", tasks: a.tasks, questions: a.questions, groupings: a.groupings ?? [], mode: a.mode, plan: null, done: [], moved: [], replan: null, undo: null, nextId: a.tasks.length + 1 };
    case "answer": {
      const q = a.question;
      const questions = s.questions.filter((x) => !(x.taskId === q.taskId && x.type === q.type));
      const tasks = s.tasks.map((t) => {
        if (t.id !== q.taskId || a.value === null) return t;
        if (q.type === "due") return { ...t, due: a.value as Task["due"] };
        if (q.type === "duration") return { ...t, durationMin: a.value as number, durationSource: "user" as const };
        return { ...t, fixedStart: String(a.value), durationSource: "user" as const };
      });
      return { ...s, tasks, questions };
    }
    case "patchTask": {
      const tasks = s.tasks.map((t) => (t.id === a.taskId ? { ...t, ...a.patch } : t));
      return s.plan ? withPlan(s, a.now, { tasks }) : { ...s, tasks };
    }
    case "removeTask": {
      const tasks = s.tasks.filter((t) => t.id !== a.taskId);
      const base = { tasks, questions: s.questions.filter((q) => q.taskId !== a.taskId), done: s.done.filter((d) => d !== a.taskId), moved: s.moved.filter((m) => m.taskId !== a.taskId), expanded: null, sheet: null as SheetState };
      return s.plan ? withPlan(s, a.now, base) : { ...s, ...base };
    }
    case "addTask": {
      const task: Task = { id: `n${s.nextId}`, ...a.task };
      const patch = { tasks: [...s.tasks, task], nextId: s.nextId + 1 };
      return s.plan ? withPlan(s, a.now, patch) : { ...s, ...patch };
    }
    case "mode":
      return { ...s, mode: a.mode };
    case "build": {
      const next: FlowState = { ...s, screen: "plan", sheet: null, expanded: null, done: [], moved: [], replan: null, undo: null, plannedAt: toHHMM(a.now), entrance: true, plan: null };
      return { ...next, plan: buildPlan(next, a.now) };
    }
    case "planned":
      return { ...s, screen: "plan", sheet: null, expanded: null, done: [], moved: [], replan: null, undo: null, tasks: a.tasks, mode: a.mode, plannedAt: a.plannedAt, entrance: true, plan: a.plan, dayId: a.dayId, version: a.version };
    case "loaded":
      return { ...s, ...fromView(a.view), screen: "plan", sheet: null, expanded: null, replan: null, undo: null, entrance: false };
    case "mutated":
      return { ...s, ...fromView(a.view), sheet: null, expanded: null, replan: null, entrance: false, undo: SNAP(s), toast: bumpToast(s, a.toast, true, a.ms ?? 8000) };
    case "undone":
      return { ...s, ...fromView(a.view), sheet: null, expanded: null, replan: null, entrance: false, undo: null, toast: null };
    case "toggleDone":
      return { ...s, entrance: false, done: s.done.includes(a.taskId) ? s.done.filter((d) => d !== a.taskId) : [...s.done, a.taskId] };
    case "expand":
      return { ...s, expanded: s.expanded === a.taskId ? null : a.taskId, entrance: false };
    case "applyReplan": {
      const c = a.constraints;
      const snap = SNAP(s);
      const dropIds = new Set(c.dropTaskIds);
      const events: Task[] = c.newEvents.map((e, i) => ({
        id: `ev${s.nextId + i}`, title: e.title, location: e.location, kind: "fixed", durationMin: Math.max(5, e.durationMin),
        durationSource: "user", fixedStart: e.start, due: null,
      }));
      const tasks = [...s.tasks.filter((t) => !dropIds.has(t.id)), ...events];
      const unfinished = new Set(c.unfinished.map((u) => u.taskId));
      const done = s.done.filter((d) => !unfinished.has(d) && !dropIds.has(d));
      const overrides: Record<string, number> = {};
      c.unfinished.forEach((u) => { if (u.remainingMin) overrides[u.taskId] = u.remainingMin; });
      const now = round5(toMin(c.now) + (c.delayMin ?? 0));
      const base = { ...s, tasks, done, moved: s.moved.filter((m) => !dropIds.has(m.taskId)) };
      const prev = s.plan;
      const plan = buildPlan(base, now, {
        minStart: now,
        capacityMin: c.capacityMin,
        lighterAfter: c.lighterAfter ? toMin(c.lighterAfter) : null,
        mustFinishTaskIds: c.mustFinishTaskIds,
        durationOverrides: overrides,
      }, tasks);
      const was = diffStarts(prev, plan);
      const replan: Replan = { at: c.now, said: a.said, was, doneIds: done, lines: changeLines(plan, tasks, was, events) };
      return {
        ...base, plan, replan, entrance: false, expanded: null, sheet: null, nextId: s.nextId + events.length, undo: snap,
        toast: bumpToast(s, "Re-planned.", true, 8000),
      };
    }
    case "undo": {
      if (!s.undo) return { ...s, toast: null };
      return { ...s, ...s.undo, undo: null, toast: null, entrance: false, expanded: null };
    }
    case "sheet":
      return { ...s, sheet: a.sheet };
    case "toast":
      return { ...s, toast: a.text ? bumpToast(s, a.text, a.undo ?? false, a.ms ?? 5000) : null };
    case "settings":
      return { ...s, settings: a.settings };
    case "presets":
      return { ...s, presets: a.presets };
    case "presetAdd":
      return { ...s, presets: [a.preset, ...s.presets.filter((x) => x.phrase.toLowerCase() !== a.preset.phrase.toLowerCase())] };
    case "presetSaved":
      return { ...s, presets: s.presets.map((x) => (x.id === a.tempId ? a.preset : x)) };
    case "presetDrop":
      return { ...s, presets: s.presets.filter((x) => x.id !== a.id) };
    case "presetRestore":
      return s.presets.some((x) => x.id === a.preset.id) ? s : { ...s, presets: [a.preset, ...s.presets] };
    case "reset":
      return { ...initialState(), settings: s.settings, presets: s.presets };
  }
}

/** 3 to 5 plain lines on what changed, built from the planner's decisions plus the biggest moves. */
export function changeLines(plan: Plan, tasks: Task[], was: Record<string, string>, events: Task[]): string[] {
  const title = (id: string) => tasks.find((t) => t.id === id)?.title ?? "A task";
  const lines: string[] = [];
  const keep = (l: string) => { if (!lines.includes(l)) lines.push(l); };
  events.forEach((e) => keep(`Added ${e.title.toLowerCase()} at ${e.fixedStart}`));
  plan.decisions.forEach(keep);
  Object.entries(was).slice(0, 3).forEach(([id, from]) => {
    const to = plan.blocks.find((b) => b.taskId === id)?.start;
    if (to) keep(`${title(id)} moved from ${from} to ${to}`);
  });
  plan.dropped.slice(0, 2).forEach((d) => keep(`${title(d.taskId)} didn't fit, so it's waiting`));
  return lines.slice(0, 5);
}

export const decisionsShown = (p: Plan): string[] => p.decisions.slice(0, 5);

export const blockFor = (p: Plan | null, id: string): Block | undefined => p?.blocks.find((b) => b.taskId === id);

/** Fact pills ("Fixed at 17:00", "Due tomorrow") for a task. */
export function factPills(t: Task): string[] {
  const out: string[] = [];
  if (t.fixedStart) out.push(`Fixed at ${t.fixedStart}`);
  if (t.due === "today") out.push("Due today");
  if (t.due === "tomorrow") out.push("Due tomorrow");
  if (t.due === "week") out.push("Due this week");
  return out;
}

export const outingSummary = (blocks: Block[]): string => {
  const total = blocks.reduce((a, b) => a + b.durationMin, 0) + 10 * Math.max(0, blocks.length - 1);
  return `${blocks.length} stops, about ${fmtDuration(total)}`;
};

export const progressText = (done: number, total: number): string => `${done} of ${total} done`;

/** "Oct 5" for a moved task's ISO date. */
export const fmtMoveDate = (iso: string): string => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Tomorrow, the next two weekdays after it, then next week. */
export const moveTargets = (today: Date): string[] => {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const out = ["Tomorrow"];
  for (let i = 2; out.length < 3; i++) {
    const d = (today.getDay() + i) % 7;
    if (d !== 0 && d !== 6) out.push(names[d]);
  }
  out.push("Next week");
  return out;
};
