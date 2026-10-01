import test from "node:test";
import assert from "node:assert/strict";
import { planDay } from "../planner";
import { validatePlan } from "../validate-plan";
import { DEFAULT_SETTINGS, type Task } from "../schemas";
import { toMin } from "../time";

const T = (id: string, title: string, location: Task["location"], kind: Task["kind"], durationMin: number, x: Partial<Task> = {}): Task =>
  ({ id, title, location, kind, durationMin, durationSource: "estimated", fixedStart: null, due: null, ...x });
const S = DEFAULT_SETTINGS;
const base = (): Task[] => [
  T("sql", "Finish SQL assignment", "anywhere", "deep", 90, { due: "tomorrow" }),
  T("groc", "Grocery shopping", "outside", "errand", 40),
  T("mom", "Call mom", "anywhere", "call", 20),
  T("gym", "Gym", "outside", "health", 60),
  T("res", "Send resume to Sarah", "anywhere", "admin", 15),
  T("app", "Work on app", "anywhere", "deep", 75),
  T("tp", "Buy toothpaste", "outside", "errand", 15),
];
const get = (p: ReturnType<typeof planDay>, id: string) => p.blocks.find((b) => b.taskId === id)!;

test("workday example is valid, SQL first, one outing, gym before errands", () => {
  const p = planDay(base(), S, { mode: "workday" });
  assert.deepEqual(validatePlan(p, base(), S, { mode: "workday" }), []);
  assert.equal(p.blocks[0].taskId, "sql");
  assert.equal(p.outings.length, 1);
  assert.ok(toMin(get(p, "gym").start) < toMin(get(p, "groc").start));
  assert.ok(["gym", "groc", "tp"].every((id) => get(p, id).outingId === "outing-1"));
});

test("day off example is valid", () => {
  const p = planDay(base(), S, { mode: "dayoff" });
  assert.deepEqual(validatePlan(p, base(), S, { mode: "dayoff" }), []);
});

test("outside appointment anchors the outing and the rest chains after it", () => {
  const tasks = [...base(), T("dent", "Dentist at 5pm", "outside", "fixed", 45, { fixedStart: "17:00" })];
  const p = planDay(tasks, S, { mode: "workday" });
  assert.deepEqual(validatePlan(p, tasks, S, { mode: "workday" }), []);
  assert.equal(get(p, "dent").start, "17:00");
  assert.ok(["dent", "gym", "groc", "tp"].every((id) => get(p, id).outingId === "outing-1"));
});

test("re-plan: finished blocks are kept, nothing new starts before the rebuild time", () => {
  const tasks = base();
  const first = planDay(tasks, S, { mode: "dayoff" });
  const keptBlock = get(first, "res");
  const rest = tasks.filter((t) => t.id !== "res");
  const meeting = T("meet", "Meeting", "work", "fixed", 60, { fixedStart: "14:00" });
  const p = planDay([...rest, meeting], S, { mode: "dayoff", minStart: toMin("11:45"), fixedBlocks: [keptBlock], durationOverrides: { sql: 60 } });
  const errs = validatePlan(p, [...tasks, meeting], S, { mode: "dayoff", minStart: toMin("11:45"), keptTaskIds: ["res"], durationOverrides: { sql: 60 } });
  assert.deepEqual(errs, []);
  assert.equal(get(p, "meet").start, "14:00");
  assert.ok(toMin(get(p, "sql").start) >= toMin("11:45"));
});

test("capacity: only 3 hours keeps the most important tasks", () => {
  const tasks = base();
  const p = planDay(tasks, S, { mode: "dayoff", capacityMin: 180 });
  const total = p.blocks.reduce((a, b) => a + b.durationMin, 0);
  assert.ok(total <= 180, `scheduled ${total}`);
  assert.ok(p.blocks.some((b) => b.taskId === "sql"));
  assert.ok(p.dropped.length > 0);
  assert.deepEqual(validatePlan(p, tasks, S, { mode: "dayoff" }), []);
});

test("must-finish task is protected under a capacity limit", () => {
  const tasks = base();
  const p = planDay(tasks, S, { mode: "dayoff", capacityMin: 120, mustFinishTaskIds: ["app"] });
  assert.ok(p.blocks.some((b) => b.taskId === "app"));
});

test("lighter afternoon limits work after 12:00", () => {
  const tasks = base();
  const p = planDay(tasks, S, { mode: "dayoff", lighterAfter: toMin("12:00") });
  const pm = p.blocks.filter((b) => toMin(b.start) >= toMin("12:00")).reduce((a, b) => a + b.durationMin, 0);
  assert.ok(pm <= 90, `afternoon load ${pm}`);
});

test("validator catches overlaps and missing tasks", () => {
  const tasks = base();
  const p = planDay(tasks, S, { mode: "dayoff" });
  const broken = { ...p, blocks: p.blocks.map((b, i) => (i === 1 ? { ...b, start: p.blocks[0].start } : b)).slice(0, -1) };
  const errs = validatePlan(broken, tasks, S, { mode: "dayoff" });
  assert.ok(errs.some((e) => e.includes("overlaps")));
  assert.ok(errs.some((e) => e.includes("neither scheduled nor dropped")));
});
