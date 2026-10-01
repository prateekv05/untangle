import test from "node:test";
import assert from "node:assert/strict";
import { initialState, reducer, type FlowState } from "../flow";
import { validatePlan } from "../validate-plan";
import { countThings, deriveQuestions, guessTask, parseTime, splitDump, tasksFromText } from "../guess";
import { appointmentTasks, EXAMPLE_DUMP, exampleTasks, fixtureTasksFor } from "../../fixtures/example";
import { interpretReplan } from "../../fixtures/replan";
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

test("move later removes the task from the plan, undo and bring back restore it", () => {
  let s = built();
  s = reducer(s, { type: "moveLater", taskId: "gym", to: "Tomorrow", now: toMin("08:30") });
  assert.ok(!s.plan!.blocks.some((b) => b.taskId === "gym"));
  assert.equal(s.toast?.text, "Gym moved to Tomorrow");
  assert.equal(s.toast?.ms, 5000);
  const undone = reducer(s, { type: "undo" });
  assert.ok(undone.plan!.blocks.some((b) => b.taskId === "gym"));
  assert.equal(undone.moved.length, 0);
  const back = reducer(s, { type: "bringBack", taskId: "gym", now: toMin("08:30") });
  assert.ok(back.plan!.blocks.some((b) => b.taskId === "gym"));
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

test("re-plan: finished stays, new meeting is fixed, undo restores the old plan", () => {
  let s = built();
  s = reducer(s, { type: "toggleDone", taskId: "res" });
  const old = s.plan;
  const c = interpretReplan("I didn't finish SQL and I have a meeting at 2.", s.tasks.filter((t) => !s.done.includes(t.id)), toMin("11:45"))!;
  assert.deepEqual(c.unfinished.map((u) => u.taskId), ["sql"]);
  assert.equal(c.newEvents[0].start, "14:00");
  s = reducer(s, { type: "applyReplan", constraints: c, said: "x", now: toMin("11:45") });
  assert.equal(s.replan?.at, "11:45");
  assert.deepEqual(s.replan?.doneIds, ["res"]);
  assert.equal(s.plan!.blocks.find((b) => b.taskId.startsWith("ev"))?.start, "14:00");
  s.plan!.blocks.filter((b) => b.taskId !== "res" && !b.taskId.startsWith("ev")).forEach((b) => assert.ok(toMin(b.start) >= toMin("11:45")));
  assert.ok(s.replan!.lines.length >= 1 && s.replan!.lines.length <= 5);
  assert.deepEqual(reducer(s, { type: "undo" }).plan, old);
});

test("interpretReplan handles the chips and returns null for nonsense", () => {
  const open = exampleTasks();
  assert.equal(interpretReplan("I'm running 90 minutes late.", open, 700)?.delayMin, 90);
  assert.equal(interpretReplan("I only have 3 hours left.", open, 700)?.capacityMin, 180);
  assert.deepEqual(interpretReplan("I must finish the app today.", open, 700)?.mustFinishTaskIds, ["app"]);
  assert.equal(interpretReplan("Make it a lighter afternoon.", open, 700)?.lighterAfter, "12:00");
  assert.equal(interpretReplan("hmm", open, 700), null);
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
