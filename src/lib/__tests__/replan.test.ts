import test from "node:test";
import assert from "node:assert/strict";
import type { DayRow } from "../day-edit";
import { changeLines, planReplanChanges, NO_LIMITS } from "../replan";
import type { Plan, ReplanConstraints } from "../schemas";

const row = (id: string, status: DayRow["status"] = "open", durationMin = 60): DayRow => ({ id, title: id === "gym" ? "Gym" : id, location: "anywhere", kind: "admin", durationMin, durationSource: "user", fixedStart: null, due: null, status, movedTo: null });
const block = (taskId: string, start: string) => ({ taskId, start, durationMin: 30, outingId: null, reason: "r", hop: null });
const plan: Plan = { blocks: [block("sql", "09:00"), block("gym", "13:00"), block("mom", "15:00")], outings: [], decisions: [], dropped: [], note: null };
const empty: ReplanConstraints = { now: "11:45", doneTaskIds: [], unfinished: [], newEvents: [], capacityMin: null, lighterAfter: null, mustFinishTaskIds: [], dropTaskIds: [], delayMin: null };
const rows = [row("sql", "done"), row("gym"), row("mom"), row("app", "moved")];
const now = 11 * 60 + 45;

test("starts at now, rounded up to 5", () => {
  assert.equal(planReplanChanges(empty, rows, plan, 11 * 60 + 47).minStart, 11 * 60 + 50);
});

test("unknown, moved and duplicate ids are ignored", () => {
  const c = planReplanChanges({ ...empty, doneTaskIds: ["ghost", "app", "mom", "mom"], dropTaskIds: ["ghost", "gym"], mustFinishTaskIds: ["ghost", "mom"] }, rows, plan, now);
  assert.deepEqual(c.markDone, ["mom"]);
  assert.deepEqual(c.drop, ["gym"]);
  assert.deepEqual(c.limits.mustFinishTaskIds, ["mom"]);
});

test("a finished task they say is not finished reopens with half the time, or what they said", () => {
  const half = planReplanChanges({ ...empty, unfinished: [{ taskId: "sql", remainingMin: null }] }, rows, plan, now);
  assert.deepEqual(half.reopen, ["sql"]);
  assert.equal(half.limits.durationOverrides.sql, 30);
  const said = planReplanChanges({ ...empty, unfinished: [{ taskId: "sql", remainingMin: 40 }] }, rows, plan, now);
  assert.equal(said.limits.durationOverrides.sql, 40);
  const big = planReplanChanges({ ...empty, unfinished: [{ taskId: "sql", remainingMin: 600 }] }, rows, plan, now);
  assert.equal(big.limits.durationOverrides.sql, 60);
});

test("an open task still to come is not shortened", () => {
  const c = planReplanChanges({ ...empty, unfinished: [{ taskId: "gym", remainingMin: null }] }, rows, plan, now);
  assert.deepEqual(c.limits.durationOverrides, {});
  assert.deepEqual(c.reopen, []);
});

test("a new event becomes a fixed task with the time they gave", () => {
  const c = planReplanChanges({ ...empty, newEvents: [{ title: "Meeting", start: "14:00", durationMin: 1, location: "work" }] }, rows, plan, now);
  assert.deepEqual(c.newEvents, [{ title: "Meeting", location: "work", kind: "fixed", durationMin: 5, durationSource: "user", fixedStart: "14:00", due: null }]);
});

test("running late pushes the start past the next block", () => {
  const c = planReplanChanges({ ...empty, now: "10:00", delayMin: 90 }, rows, plan, 10 * 60);
  assert.equal(c.minStart, 13 * 60 + 90);
  assert.equal(planReplanChanges({ ...empty, delayMin: 15 }, rows, null, now).minStart, now + 15);
});

test("limits are passed in minutes", () => {
  const c = planReplanChanges({ ...empty, capacityMin: 180, lighterAfter: "12:00" }, rows, plan, now);
  assert.equal(c.limits.capacityMin, 180);
  assert.equal(c.limits.lighterAfter, 720);
});

test("change lines are true to the plans", () => {
  const next: Plan = { ...plan, blocks: [block("ev", "14:00"), block("gym", "13:30")], dropped: [{ taskId: "mom", why: "w" }] };
  const lines = changeLines(plan, next, new Map([["ev", "Meeting"], ["gym", "Gym"], ["mom", "Call mom"]]), { gym: "13:00" }, NO_LIMITS, ["ev"]);
  assert.deepEqual(lines, ["Meeting is in at 14:00, and the rest works around it", "Call mom waits for another day", "Gym moved from 13:00"]);
});

import { applyReplanChanges } from "../replan";

test("changes are applied to the rows the way the route saves them", () => {
  const c = planReplanChanges({ ...empty, unfinished: [{ taskId: "sql", remainingMin: null }], dropTaskIds: ["gym"], doneTaskIds: ["mom"], newEvents: [{ title: "Meeting", start: "14:00", durationMin: 60, location: "work" }] }, rows, plan, now);
  const next = applyReplanChanges(rows, c, ["ev1"], "2026-10-04");
  const by = Object.fromEntries(next.map((r) => [r.id, r]));
  assert.equal(by.sql.status, "open");
  assert.equal(by.mom.status, "done");
  assert.equal(by.gym.status, "moved");
  assert.equal(by.gym.movedTo, "2026-10-04");
  assert.equal(by.ev1.kind, "fixed");
  assert.equal(by.ev1.status, "open");
});

test("a new event about something already on the day is not added a second time", () => {
  const event = (title: string) => ({ title, start: "17:00", durationMin: 60, location: "outside" as const });
  const c = planReplanChanges({ ...empty, newEvents: [event("Go to the gym"), event("Dentist")] }, rows, plan, now);
  assert.deepEqual(c.newEvents.map((e) => e.title), ["Dentist"]);
});
