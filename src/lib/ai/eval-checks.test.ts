import test from "node:test";
import assert from "node:assert/strict";
import { applyAnswers, check, type Subject } from "../../../scripts/eval";
import { planStart } from "./plan";
import { planDay } from "../planner";
import { DEFAULT_SETTINGS, type Task, type UnderstandResult } from "../schemas";

const task = (id: string, title: string, o: Partial<Task> = {}): Task => ({ id, title, location: "anywhere", kind: "admin", durationMin: 30, durationSource: "estimated", fixedStart: null, due: null, ...o });
const tasks = [task("t1", "SQL assignment", { kind: "deep", durationMin: 90 }), task("t2", "Gym", { location: "outside", kind: "health", durationMin: 60 }), task("t3", "Groceries", { location: "outside", kind: "errand" })];
const result: UnderstandResult = { planFor: "today", tasks, questions: [{ type: "due", taskId: "t1", prompt: "?", options: ["today"] }], groupings: [] };
const subject = (): Subject => ({ result, plan: planDay(tasks, DEFAULT_SETTINGS, { mode: "dayoff" }), mode: "dayoff", settings: DEFAULT_SETTINGS });

test("plan assertions read the plan by task title", () => {
  const s = subject();
  assert.equal(check({ a: "validPlan" }, s, ""), null);
  assert.equal(check({ a: "oneOuting", titles: ["Gym", "Groceries"] }, s, ""), null);
  assert.equal(check({ a: "before", first: "SQL", second: "Gym" }, s, ""), null);
  assert.match(check({ a: "before", first: "Gym", second: "SQL" }, s, "") ?? "", /not before/);
  assert.match(check({ a: "hasDropped" }, s, "") ?? "", /nothing was dropped/);
  assert.equal(check({ a: "reasonsPresent" }, s, ""), null);
  assert.match(check({ a: "noStartBefore", time: "23:00" }, s, "") ?? "", /before 23:00/);
});

test("an outing with another block between its stops fails", () => {
  const s = subject();
  const [a, b] = s.plan.blocks.filter((x) => x.outingId);
  const mid = s.plan.blocks.find((x) => !x.outingId)!;
  const split = { ...s.plan, blocks: s.plan.blocks.map((x) => (x === mid ? { ...x, start: "21:00" } : x === b ? { ...x, start: "22:00" } : x)) };
  assert.match(check({ a: "oneOuting", titles: ["Gym", "Groceries"] }, { ...s, plan: split }, "") ?? "", /back to back/);
});

test("auto-answers apply only to questions that were asked", () => {
  const out = applyAnswers(result, [{ match: "SQL", due: "tomorrow" }, { match: "Gym", durationMin: 90 }]);
  assert.equal(out.tasks[0].due, "tomorrow");
  assert.equal(out.tasks[1].durationMin, 60); // no duration question was asked about the gym
});

test("plan start: now rounded up for today, an hour after waking for another day", () => {
  assert.equal(planStart(true, "08:32", DEFAULT_SETTINGS), 8 * 60 + 35);
  assert.equal(planStart(true, "03:10", DEFAULT_SETTINGS), 7 * 60);
  assert.equal(planStart(false, "21:00", DEFAULT_SETTINGS), 8 * 60);
});
