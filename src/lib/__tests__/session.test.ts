import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequireUser, toSessionUser, UnauthorizedError } from "../session";

const row = {
  id: "u1", email: "sam@example.com", googleSub: "g1", passwordHash: "salt:hash", name: "Sam", gender: null,
  onboardedAt: new Date("2026-10-01T00:00:00Z"), createdAt: new Date(),
};

test("requireUser rejects when there is no session", async () => {
  const requireUser = createRequireUser({ getSessionUserId: async () => null, getUser: async () => row });
  await assert.rejects(requireUser(), UnauthorizedError);
});

test("requireUser rejects a valid session whose account no longer exists", async () => {
  const requireUser = createRequireUser({ getSessionUserId: async () => "u1", getUser: async () => null });
  await assert.rejects(requireUser(), UnauthorizedError);
});

test("requireUser returns the user without the password hash", async () => {
  const requireUser = createRequireUser({ getSessionUserId: async () => "u1", getUser: async () => row });
  const user = await requireUser();
  assert.deepEqual(user, { id: "u1", email: "sam@example.com", name: "Sam", gender: null, onboarded: true, hasPassword: true });
  assert.equal(JSON.stringify(user).includes("salt:hash"), false);
});

test("toSessionUser reports onboarded false and no password", () => {
  const user = toSessionUser({ ...row, onboardedAt: null, passwordHash: null });
  assert.equal(user.onboarded, false);
  assert.equal(user.hasPassword, false);
});
