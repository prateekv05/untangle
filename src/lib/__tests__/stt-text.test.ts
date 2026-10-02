import assert from "node:assert/strict";
import { test } from "node:test";
import { audioFileName, heardChips, pickMime, planningChip } from "../stt/text";

test("heard chips: strips filler, holds back the piece still being spoken", () => {
  const said = "Okay, tomorrow I need to finish my SQL assignment, I have to go grocery shopping, I need to call my mom and I want to go to the gy";
  assert.deepEqual(heardChips(said).map((c) => c.title), ["Finish my SQL assignment", "Go grocery shopping", "Call my mom"]);
  assert.equal(heardChips(said, true).length, 4);
});

test("heard chips: location comes from the words, duplicates collapse", () => {
  const chips = heardChips("buy toothpaste, buy toothpaste, call mom, ", false);
  assert.deepEqual(chips.map((c) => [c.title, c.location]), [["Buy toothpaste", "outside"], ["Call mom", "anywhere"]]);
});

test("heard chips: nothing yet gives an empty list", () => {
  assert.deepEqual(heardChips(""), []);
  assert.deepEqual(heardChips("um okay so"), []);
});

test("planning chip: tomorrow, a named day, today, or nothing", () => {
  assert.equal(planningChip("okay tomorrow I need to", 4), "Planning for tomorrow, Friday");
  assert.equal(planningChip("on Saturday I will", 4), "Planning for Saturday");
  assert.equal(planningChip("today I want to", 4), "Planning for today, Thursday");
  assert.equal(planningChip("I need milk", 4), null);
});

test("mime: webm first, mp4 on Safari, null when nothing is known", () => {
  assert.equal(pickMime(() => true), "audio/webm;codecs=opus");
  assert.equal(pickMime((m) => m === "audio/mp4"), "audio/mp4");
  assert.equal(pickMime(() => false), null);
  assert.equal(audioFileName("audio/mp4"), "dump.m4a");
  assert.equal(audioFileName("audio/webm;codecs=opus"), "dump.webm");
});
