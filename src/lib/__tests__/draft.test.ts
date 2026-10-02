import test from "node:test";
import assert from "node:assert/strict";
import { DraftPayload, draftFrom, nextLocalId } from "../draft";
import { initialState, reducer } from "../flow";
import { exampleTasks } from "../../fixtures/example";
import type { Task } from "../schemas";

const base = { mode: "workday" as const, tasks: [], questions: [], groupings: [] };
const task = (id: string): Task => ({ id, title: "Call Mom", location: "anywhere", kind: "call", durationMin: 15, durationSource: "estimated", fixedStart: null, due: null });

test("Dump saves its text, and clears the draft when the box is empty", () => {
  assert.deepEqual(draftFrom({ ...base, screen: "dump", text: "gym, groceries" }, null), { screen: "dump", text: "gym, groceries", mode: "workday", dayId: null, tasks: [], questions: [], groupings: [] });
  assert.equal(draftFrom({ ...base, screen: "dump", text: "   " }, null), null);
});

test("Understand saves the tasks with the day they belong to", () => {
  const tasks = [task("n1")];
  const d = draftFrom({ ...base, screen: "understand", text: "call mom", tasks }, "5b4f0c42-9d7e-4c52-9b3e-0d9a7a1a0c11");
  assert.equal(d?.screen, "understand");
  assert.equal(d?.dayId, "5b4f0c42-9d7e-4c52-9b3e-0d9a7a1a0c11");
  assert.equal(draftFrom({ ...base, screen: "understand", text: "x", tasks: [] }, null), null);
});

test("Listening, Thinking and Plan leave the draft alone", () => {
  for (const screen of ["listening", "thinking", "plan"]) assert.equal(draftFrom({ ...base, screen, text: "gym", tasks: [task("n1")] }, null), undefined);
});

test("a saved draft parses back, and a draft with a bad shape is refused", () => {
  const d = draftFrom({ ...base, screen: "understand", text: "x", tasks: exampleTasks().slice(0, 2) }, null)!;
  assert.deepEqual(DraftPayload.parse(JSON.parse(JSON.stringify(d))), d);
  assert.equal(DraftPayload.safeParse({ ...d, screen: "plan" }).success, false);
  assert.equal(DraftPayload.safeParse({ ...d, extra: 1 }).success, false);
});

test("restoring an Understand draft puts the screen back and never reuses a local id", () => {
  const tasks = [task("5b4f0c42-9d7e-4c52-9b3e-0d9a7a1a0c11"), task("n4")];
  const draft = draftFrom({ ...base, screen: "understand", text: "call mom", tasks }, "5b4f0c42-9d7e-4c52-9b3e-0d9a7a1a0c11")!;
  const s = reducer(initialState(), { type: "restoreDraft", draft });
  assert.equal(s.screen, "understand");
  assert.equal(s.text, "call mom");
  assert.deepEqual(s.tasks, tasks);
  assert.equal(s.nextId, 5);
  assert.equal(nextLocalId([]), 1);
});

test("restoring a Dump draft returns to Dump with the words", () => {
  const draft = draftFrom({ ...base, screen: "dump", text: "gym" }, null)!;
  const s = reducer(initialState(), { type: "restoreDraft", draft });
  assert.equal(s.screen, "dump");
  assert.equal(s.text, "gym");
});
