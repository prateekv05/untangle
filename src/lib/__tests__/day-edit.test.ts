import test from "node:test";
import assert from "node:assert/strict";
import { activeTasks, checkOp, keptBlocksFor, resolveMoveTarget, sameTitle, type DayRow } from "../day-edit";
import type { Plan } from "../schemas";

const row = (id: string, status: DayRow["status"] = "open"): DayRow => ({ id, title: id, location: "anywhere", kind: "admin", durationMin: 30, durationSource: "user", fixedStart: null, due: null, status, movedTo: null });
const block = (taskId: string, start: string) => ({ taskId, start, durationMin: 30, outingId: null, reason: "r", hop: null });
const plan: Plan = { blocks: [block("a", "09:00"), block("b", "10:00")], outings: [], decisions: [], dropped: [], note: null };

test("only open and finished tasks are planned", () => {
  assert.deepEqual(activeTasks([row("a"), row("b", "done"), row("c", "moved"), row("d", "deleted")]).map((t) => t.id), ["a", "b"]);
  assert.ok(!("status" in activeTasks([row("a")])[0]));
});

test("finished tasks keep their blocks, nothing else does", () => {
  assert.deepEqual(keptBlocksFor(plan, [row("a", "done"), row("b")]), [block("a", "09:00")]);
  assert.deepEqual(keptBlocksFor(null, [row("a", "done")]), []);
  assert.deepEqual(keptBlocksFor(plan, [row("a", "moved"), row("b")]), []);
});

test("changes that make no sense are refused", () => {
  const rows = [row("a"), row("b", "done"), row("c", "moved"), row("d", "deleted")];
  assert.throws(() => checkOp(rows, { type: "delete", taskId: "zzz" }));
  assert.throws(() => checkOp(rows, { type: "edit", taskId: "b", patch: { title: "x" } }), /finished/);
  assert.throws(() => checkOp(rows, { type: "move", taskId: "c", to: "2026-10-05" }));
  assert.throws(() => checkOp(rows, { type: "bringBack", taskId: "a" }));
  assert.throws(() => checkOp(rows, { type: "delete", taskId: "d" }));
  assert.doesNotThrow(() => checkOp(rows, { type: "bringBack", taskId: "c" }));
  assert.doesNotThrow(() => checkOp(rows, { type: "move", taskId: "b", to: "2026-10-05" }));
  assert.doesNotThrow(() => checkOp(rows, { type: "add", task: { title: "n", location: "home", kind: "chore", durationMin: 20, durationSource: "user", fixedStart: null, due: null } }));
});

test("move targets land on real later dates", () => {
  // 2026-10-02 is a Friday
  assert.equal(resolveMoveTarget("Tomorrow", "2026-10-02"), "2026-10-03");
  assert.equal(resolveMoveTarget("Monday", "2026-10-02"), "2026-10-05");
  assert.equal(resolveMoveTarget("Tuesday", "2026-10-02"), "2026-10-06");
  assert.equal(resolveMoveTarget("Next week", "2026-10-02"), "2026-10-05");
  assert.equal(resolveMoveTarget("Next week", "2026-10-04"), "2026-10-05"); // Sunday
  assert.equal(resolveMoveTarget("2026-11-01", "2026-10-02"), "2026-11-01");
  assert.throws(() => resolveMoveTarget("Someday", "2026-10-02"));
});

test("sameTitle matches the same thing said two ways, not different things", () => {
  assert.ok(sameTitle("Gym", "Go to the gym"));
  assert.ok(sameTitle("call mom", "Call Mom."));
  assert.ok(!sameTitle("Gym", "Gymnastics class"));
  assert.ok(!sameTitle("Call mom", "Call dentist"));
  assert.ok(!sameTitle("", "Gym"));
});
