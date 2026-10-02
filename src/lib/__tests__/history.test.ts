import test from "node:test";
import assert from "node:assert/strict";
import { historyDate, historySummary } from "../history";

test("a past day reads as a weekday and date", () => {
  assert.equal(historyDate("2026-10-06"), "Tuesday, October 6");
});

test("the summary says the kind of day, how much got done and what moved on", () => {
  assert.equal(historySummary({ mode: "workday", total: 7, done: 5, moved: 0 }), "Workday. 5 of 7 done.");
  assert.equal(historySummary({ mode: "dayoff", total: 4, done: 2, moved: 1 }), "Day off. 2 of 4 done, 1 moved on.");
  assert.equal(historySummary({ mode: "workday", total: 3, done: 0, moved: 0 }), "Workday. 3 tasks.");
  assert.equal(historySummary({ mode: "workday", total: 1, done: 0, moved: 0 }), "Workday. 1 task.");
  assert.equal(historySummary({ mode: "workday", total: 0, done: 0, moved: 0 }), "Workday. No tasks.");
});
