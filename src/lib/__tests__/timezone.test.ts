import test from "node:test";
import assert from "node:assert/strict";
import { addDays, localClock } from "../timezone";

test("localClock reads the date, time and weekday in the given zone", () => {
  const at = new Date("2026-10-03T23:30:00Z"); // Saturday UTC
  assert.deepEqual(localClock("UTC", at), { date: "2026-10-03", time: "23:30", weekday: 6 });
  assert.deepEqual(localClock("Asia/Kolkata", at), { date: "2026-10-04", time: "05:00", weekday: 0 });
  assert.deepEqual(localClock("America/Los_Angeles", at), { date: "2026-10-03", time: "16:30", weekday: 6 });
});

test("localClock never shows 24:00 at midnight", () => {
  assert.equal(localClock("UTC", new Date("2026-10-04T00:05:00Z")).time, "00:05");
});

test("addDays crosses month and year ends", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
