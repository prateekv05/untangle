import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../password";

test("hash then verify round-trips and rejects a wrong password", async () => {
  const stored = await hashPassword("correct horse battery");
  assert.match(stored, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("correct horse battery", stored), true);
  assert.equal(await verifyPassword("correct horse batterz", stored), false);
});

test("the same password hashes differently each time (random salt)", async () => {
  assert.notEqual(await hashPassword("same password 1"), await hashPassword("same password 1"));
});

test("malformed stored values never match", async () => {
  for (const bad of ["", "abc", "zz:zz", "aa:bb", "a:b:c"]) assert.equal(await verifyPassword("x", bad), false);
});
