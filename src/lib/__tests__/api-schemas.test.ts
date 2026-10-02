import assert from "node:assert/strict";
import { test } from "node:test";
import { DayQuery, PresetBody, SettingsInput, TaskPatchBody } from "../api-schemas";

const settings = { workStart: "09:00", workEnd: "17:00", workDays: [1, 2, 3], wake: "07:00", sleep: "23:00", timezone: "Europe/London" };

test("settings: sorts and dedupes work days, rejects bad times, zones and extra keys", () => {
  assert.deepEqual(SettingsInput.parse({ ...settings, workDays: [5, 1, 1, 3] }).workDays, [1, 3, 5]);
  assert.equal(SettingsInput.safeParse({ ...settings, workStart: "9am" }).success, false);
  assert.equal(SettingsInput.safeParse({ ...settings, workDays: [7] }).success, false);
  assert.equal(SettingsInput.safeParse({ ...settings, timezone: "Mars/Olympus" }).success, false);
  assert.equal(SettingsInput.safeParse({ ...settings, extra: 1 }).success, false);
  assert.equal(SettingsInput.safeParse({}).success, false);
});

test("preset: trims the phrase, no fixed kind, duration 5 to 480 or null", () => {
  const ok = { verb: "  Swim ", location: "outside", kind: "health", defaultDurationMin: 45 };
  assert.equal(PresetBody.parse(ok).verb, "Swim");
  assert.equal(PresetBody.parse({ ...ok, defaultDurationMin: null }).defaultDurationMin, null);
  assert.equal(PresetBody.safeParse({ ...ok, kind: "fixed" }).success, false);
  assert.equal(PresetBody.safeParse({ ...ok, verb: "   " }).success, false);
  assert.equal(PresetBody.safeParse({ ...ok, defaultDurationMin: 4 }).success, false);
  assert.equal(PresetBody.safeParse({ ...ok, defaultDurationMin: 481 }).success, false);
});

test("day query needs a real ISO date", () => {
  assert.equal(DayQuery.safeParse({ date: "2026-10-01" }).success, true);
  for (const date of ["tomorrow", "2026-02-30", "10/01/2026", ""]) assert.equal(DayQuery.safeParse({ date }).success, false, date);
  assert.equal(DayQuery.safeParse({}).success, false);
});

test("task patch: needs a field, only open or done, moveTo stands alone", () => {
  assert.equal(TaskPatchBody.safeParse({}).success, false);
  assert.equal(TaskPatchBody.safeParse({ status: "deleted" }).success, false);
  assert.equal(TaskPatchBody.safeParse({ status: "done" }).success, true);
  assert.equal(TaskPatchBody.safeParse({ fixedStart: null, due: null }).success, true);
  assert.equal(TaskPatchBody.safeParse({ durationMin: -5 }).success, false);
  assert.equal(TaskPatchBody.safeParse({ moveTo: "2026-10-02" }).success, true);
  assert.equal(TaskPatchBody.safeParse({ moveTo: "2026-10-02", title: "x" }).success, false);
  assert.equal(TaskPatchBody.safeParse({ id: "other" }).success, false);
});

test("understandBody trims, requires text and enforces the cap", async () => {
  const { understandBody } = await import("../api-schemas");
  const body = understandBody(10);
  assert.equal(body.parse({ text: "  gym  " }).text, "gym");
  assert.throws(() => body.parse({ text: "   " }));
  assert.throws(() => body.parse({ text: "x".repeat(11) }));
  assert.throws(() => body.parse({ text: "gym", extra: 1 }));
});
