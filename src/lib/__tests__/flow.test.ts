import test from "node:test";
import assert from "node:assert/strict";
import { initialState, reducer, type FlowState } from "../flow";
import type { DayView } from "../day-response";
import { validatePlan } from "../validate-plan";
import { countThings, deriveQuestions, guessTask, parseTime, splitDump, tasksFromText } from "../guess";
import { appointmentTasks, EXAMPLE_DUMP, exampleTasks, fixtureTasksFor } from "../../fixtures/example";
import { browserTimezone, nowMinutes } from "../clock";
import { DEFAULT_SETTINGS } from "../schemas";
import { toMin } from "../time";

const built = (): FlowState => {
  let s = reducer(initialState(), { type: "understood", tasks: exampleTasks(), questions: [], mode: "dayoff" });
  s = reducer(s, { type: "build", now: toMin("08:30") });
  return s;
};

test("fixture plans are real valid plans", () => {
  for (const [tasks, mode] of [[exampleTasks(), "workday"], [exampleTasks(), "dayoff"], [appointmentTasks(), "workday"]] as const) {
    let s = reducer(initialState(), { type: "understood", tasks, questions: [], mode });
    s = reducer(s, { type: "build", now: toMin("08:30") });
    assert.deepEqual(validatePlan(s.plan!, tasks, DEFAULT_SETTINGS, { mode }), []);
  }
});

test("demo dumps resolve to fixture tasks, other text goes through the guesser", () => {
  assert.equal(fixtureTasksFor(EXAMPLE_DUMP)?.length, 7);
  assert.equal(fixtureTasksFor("something else"), null);
});

test("finishing keeps the block in place and un-finishing undoes it", () => {
  let s = built();
  const before = s.plan!.blocks.find((b) => b.taskId === "mom")!;
  s = reducer(s, { type: "toggleDone", taskId: "mom" });
  assert.deepEqual(s.done, ["mom"]);
  assert.deepEqual(s.plan!.blocks.find((b) => b.taskId === "mom"), before);
  s = reducer(s, { type: "toggleDone", taskId: "mom" });
  assert.deepEqual(s.done, []);
});

const view = (over: Partial<DayView> = {}): DayView => {
  const s = built();
  return { dayId: "d1", mode: "workday", plan: s.plan!, version: 2, source: "llm", model: null, plannedAt: "09:00", tasks: s.tasks.map((t) => ({ ...t, status: "open" as const, movedTo: null })), ...over };
};

test("a saved day opens on the plan with finished and moved tasks restored", () => {
  const v = view();
  const tasks = v.tasks.map((t) => (t.id === "mom" ? { ...t, status: "done" as const } : t.id === "gym" ? { ...t, status: "moved" as const, movedTo: "2026-10-03" } : t));
  const s = reducer(initialState(), { type: "loaded", view: { ...v, tasks } });
  assert.equal(s.screen, "plan");
  assert.deepEqual(s.done, ["mom"]);
  assert.deepEqual(s.moved, [{ taskId: "gym", to: "2026-10-03" }]);
  assert.equal(s.version, 2);
  assert.equal(s.dayId, "d1");
  assert.equal(s.entrance, false);
  assert.ok(!("status" in s.tasks[0]));
});

test("a saved change swaps the plan in place and keeps the old state for Undo", () => {
  const before = built();
  const v = view({ version: 3, tasks: view().tasks.map((t) => (t.id === "gym" ? { ...t, status: "moved" as const, movedTo: "2026-10-03" } : t)) });
  const s = reducer({ ...before, dayId: "d1", version: 2 }, { type: "mutated", view: v, toast: "Gym moved to Tomorrow", ms: 5000 });
  assert.equal(s.version, 3);
  assert.equal(s.moved.length, 1);
  assert.equal(s.undo?.version, 2);
  assert.deepEqual(s.undo?.moved, []);
  assert.equal(s.toast?.undo, true);
  assert.equal(s.toast?.ms, 5000);
  const back = reducer(s, { type: "undone", view: view({ version: 4 }) });
  assert.equal(back.moved.length, 0);
  assert.equal(back.version, 4);
  assert.equal(back.undo, null);
});

test("editing re-plans only unfinished tasks; finished blocks stay put", () => {
  let s = built();
  s = reducer(s, { type: "toggleDone", taskId: "sql" });
  const sql = s.plan!.blocks.find((b) => b.taskId === "sql")!;
  s = reducer(s, { type: "patchTask", taskId: "gym", patch: { durationMin: 90, durationSource: "user" }, now: toMin("09:00") });
  assert.deepEqual(s.plan!.blocks.find((b) => b.taskId === "sql"), sql);
  assert.equal(s.plan!.blocks.find((b) => b.taskId === "gym")!.durationMin, 90);
  s.plan!.blocks.filter((b) => b.taskId !== "sql").forEach((b) => assert.ok(toMin(b.start) >= toMin("09:00")));
});

test("add task re-plans and the new task is scheduled or dropped", () => {
  let s = built();
  s = reducer(s, { type: "addTask", task: guessTask("Water the plants"), now: toMin("08:30") });
  const id = s.tasks.at(-1)!.id;
  assert.ok(s.plan!.blocks.some((b) => b.taskId === id) || s.plan!.dropped.some((d) => d.taskId === id));
});

test("a saved re-plan swaps the day in, shows what changed and can be undone locally", () => {
  let s = built();
  s = reducer(s, { type: "toggleDone", taskId: "res" });
  const old = s.plan;
  const view = {
    dayId: "d", mode: s.mode, plan: { ...s.plan!, decisions: [] }, version: 2, source: "llm" as const, model: "m", plannedAt: "11:45",
    tasks: s.tasks.map((t) => ({ ...t, status: t.id === "res" ? ("done" as const) : ("open" as const), movedTo: null })),
    changes: { at: "11:45", was: { sql: "09:00" }, lines: ["SQL moved from 09:00"] },
  };
  s = reducer(s, { type: "replanned", view, said: "I didn't finish SQL" });
  assert.equal(s.replan?.at, "11:45");
  assert.equal(s.replan?.said, "I didn't finish SQL");
  assert.deepEqual(s.replan?.doneIds, ["res"]);
  assert.deepEqual(s.replan?.was, { sql: "09:00" });
  assert.equal(s.version, 2);
  assert.equal(s.toast?.undo, true);
  assert.deepEqual(reducer(s, { type: "undo" }).plan, old);
});

test("splitDump, counts and time parsing", () => {
  assert.equal(countThings(EXAMPLE_DUMP), 7);
  assert.deepEqual(splitDump("I need to call mom and buy milk"), ["call mom", "buy milk"]);
  assert.equal(countThings(""), 0);
  assert.equal(parseTime("dentist at 5pm"), "17:00");
  assert.equal(parseTime("meeting at 2"), "14:00");
  assert.equal(parseTime("lunch at 12:30"), "12:30");
  assert.equal(parseTime("no time here"), null);
});

test("guessTask: presets win, fixed times are user-set, ask-colour kinds stay estimated", () => {
  const gym = guessTask("gym");
  assert.equal(gym.location, "outside");
  assert.equal(gym.durationSource, "estimated");
  const preset = guessTask("Gym session", [{ id: "u1", phrase: "Gym", location: "outside", kind: "health", durationMin: 90 }]);
  assert.equal(preset.durationMin, 90);
  assert.equal(preset.durationSource, "preset");
  const d = guessTask("dentist at 5pm");
  assert.equal(d.fixedStart, "17:00");
  assert.equal(d.kind, "fixed");
  assert.equal(d.durationSource, "user");
});

test("deriveQuestions asks at most 3, only what matters, and never twice", () => {
  const qs = deriveQuestions(tasksFromText(EXAMPLE_DUMP));
  assert.deepEqual(qs.map((q) => q.type).sort(), ["due", "duration"]);
  let s = reducer(initialState(), { type: "understood", tasks: tasksFromText(EXAMPLE_DUMP), questions: qs, mode: "workday" });
  s = reducer(s, { type: "answer", question: qs[0], value: qs[0].type === "due" ? "tomorrow" : 60 });
  assert.equal(s.questions.length, 1);
});

test("clock: ?now pins the time, real time is clamped to the daytime window", () => {
  assert.equal(nowMinutes("?now=11:45"), toMin("11:45"));
  assert.equal(nowMinutes("", new Date(2026, 9, 1, 3, 0)), toMin("08:30"));
  assert.equal(nowMinutes("", new Date(2026, 9, 1, 23, 0)), toMin("19:00"));
});

test("browserTimezone returns an IANA zone name", () => {
  const tz = browserTimezone();
  assert.ok(tz === "UTC" || tz.includes("/"), tz);
});

test("optimistic preset edits: add replaces the same phrase, swap keeps order, drop and restore round-trip", () => {
  const swim = { id: "tmp-1", phrase: "Swim", location: "outside" as const, kind: "health" as const, durationMin: 45 };
  let s = reducer(initialState(), { type: "presetAdd", preset: swim });
  s = reducer(s, { type: "presetAdd", preset: { ...swim, id: "tmp-2", phrase: "swim", durationMin: null } });
  assert.deepEqual(s.presets.map((p) => p.id), ["tmp-2"]); // same phrase in any case is one preset
  s = reducer(s, { type: "presetSaved", tempId: "tmp-2", preset: { ...swim, id: "real-2", phrase: "swim", durationMin: null } });
  assert.deepEqual(s.presets.map((p) => p.id), ["real-2"]);
  const gone = s.presets[0];
  s = reducer(s, { type: "presetDrop", id: "real-2" });
  assert.deepEqual(s.presets, []);
  s = reducer(s, { type: "presetRestore", preset: gone });
  s = reducer(s, { type: "presetRestore", preset: gone }); // restoring twice does not duplicate
  assert.deepEqual(s.presets.map((p) => p.id), ["real-2"]);
});

test("planned reveals the server's plan, tasks and mode with the entrance animation", () => {
  const before = reducer(initialState(), { type: "understood", tasks: exampleTasks(), questions: [], mode: "workday" });
  const server = built();
  const s = reducer(before, { type: "planned", dayId: "d1", version: 1, plan: server.plan!, tasks: server.tasks, mode: "dayoff", plannedAt: "09:15" });
  assert.equal(s.screen, "plan");
  assert.equal(s.plan, server.plan);
  assert.equal(s.mode, "dayoff");
  assert.equal(s.plannedAt, "09:15");
  assert.equal(s.entrance, true);
  assert.deepEqual(s.done, []);
});

test("starting a new dump opens a blank Dump screen and keeps the plan, so Back to my plan has something to show", () => {
  const before = reducer(built(), { type: "toggleDone", taskId: exampleTasks()[0].id });
  const s = reducer(before, { type: "newdump" });
  assert.equal(s.screen, "dump");
  assert.equal(s.text, "");
  assert.equal(s.plan, before.plan);
  assert.deepEqual(s.tasks, before.tasks);
  assert.deepEqual(s.done, before.done);
  assert.equal(reducer(s, { type: "screen", screen: "plan" }).plan, before.plan);
});

test("planned keeps the tasks already finished on the day", () => {
  const server = built();
  const id = server.tasks[0].id;
  const s = reducer(initialState(), { type: "planned", dayId: "d1", version: 2, plan: server.plan!, tasks: server.tasks, mode: "workday", plannedAt: "09:15", done: [id] });
  assert.deepEqual(s.done, [id]);
});
