import assert from "node:assert/strict";
import { test } from "node:test";
import { MeUpdate } from "../account-schemas";

test("MeUpdate accepts a name, a gender, null gender and complete", () => {
  assert.ok(MeUpdate.safeParse({ name: "  Sam " }).success);
  assert.equal(MeUpdate.parse({ name: "  Sam " }).name, "Sam");
  assert.ok(MeUpdate.safeParse({ gender: "non_binary" }).success);
  assert.ok(MeUpdate.safeParse({ gender: null }).success);
  assert.ok(MeUpdate.safeParse({ complete: true }).success);
});

test("MeUpdate rejects empty, long, unknown and malformed input", () => {
  for (const bad of [{}, { name: "" }, { name: "   " }, { name: "x".repeat(41) }, { gender: "other" }, { complete: false }, { name: "Sam", email: "a@b.c" }, null, "Sam"]) {
    assert.equal(MeUpdate.safeParse(bad).success, false, JSON.stringify(bad));
  }
});
