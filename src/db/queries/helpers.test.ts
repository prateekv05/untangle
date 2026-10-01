import assert from "node:assert/strict";
import { test } from "node:test";
import { assertMoveTarget, cleanPatch, isIsoDate, normalizeEmail, rowToTask, windowStart } from "./helpers";

test("isIsoDate accepts real dates only", () => {
  assert.equal(isIsoDate("2026-10-01"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("10/01/2026"), false);
});

test("assertMoveTarget requires a later day", () => {
  assertMoveTarget("2026-10-01", "2026-10-02");
  assert.throws(() => assertMoveTarget("2026-10-01", "2026-10-01"));
  assert.throws(() => assertMoveTarget("2026-10-01", "2026-09-30"));
  assert.throws(() => assertMoveTarget("2026-10-01", "tomorrow"));
});

test("cleanPatch drops undefined but keeps null", () => {
  assert.deepEqual(cleanPatch({ title: undefined, fixedStart: null, durationMin: 30 }), { fixedStart: null, durationMin: 30 });
});

test("rowToTask omits storage columns", () => {
  const task = rowToTask({
    id: "t1", dayId: "d1", title: "Gym", location: "outside", kind: "health", durationMin: 60,
    durationSource: "user", fixedStart: null, due: null, status: "open", movedTo: null, position: 0, createdAt: new Date(),
  });
  assert.deepEqual(Object.keys(task).sort(), ["due", "durationMin", "durationSource", "fixedStart", "id", "kind", "location", "title"]);
});

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Sam@Example.COM "), "sam@example.com");
});

test("windowStart floors to the window boundary", () => {
  const w = 15 * 60 * 1000;
  const a = windowStart(new Date("2026-10-01T10:07:30Z"), w);
  assert.equal(a.toISOString(), "2026-10-01T10:00:00.000Z");
  assert.equal(windowStart(new Date("2026-10-01T10:14:59Z"), w).getTime(), a.getTime());
  assert.notEqual(windowStart(new Date("2026-10-01T10:15:00Z"), w).getTime(), a.getTime());
});
