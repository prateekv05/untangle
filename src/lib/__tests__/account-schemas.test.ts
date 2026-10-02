import assert from "node:assert/strict";
import { test } from "node:test";
import { MeUpdate, PasswordUpdate } from "../account-schemas";

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

test("PasswordUpdate needs at least 10 characters and nothing else", () => {
  assert.ok(PasswordUpdate.safeParse({ password: "ten chars!!" }).success);
  assert.ok(PasswordUpdate.safeParse({ password: "1234567890" }).success);
  for (const bad of [{ password: "123456789" }, { password: "x".repeat(201) }, {}, { password: "long enough pw", extra: 1 }, { password: 1234567890 }]) {
    assert.equal(PasswordUpdate.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

test("MeUpdate takes a real timezone only", () => {
  assert.equal(MeUpdate.parse({ timezone: "Europe/London", complete: true }).timezone, "Europe/London");
  for (const timezone of ["Mars/Olympus", "", "x".repeat(65)]) assert.equal(MeUpdate.safeParse({ timezone }).success, false, timezone);
});
