import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIp, redirectFor } from "../auth-rules";

const out = { signedIn: false, onboarded: false };
const fresh = { signedIn: true, onboarded: false };
const done = { signedIn: true, onboarded: true };

test("signed out sees only the landing page and Welcome", () => {
  assert.equal(redirectFor("/welcome", out), null);
  assert.equal(redirectFor("/", out), null);
  assert.equal(redirectFor("/dev/gallery", out), "/welcome");
  assert.equal(redirectFor("/welcome/name", out), "/welcome");
});

test("a new account is held in onboarding until it is done", () => {
  assert.equal(redirectFor("/welcome/name", fresh), null);
  assert.equal(redirectFor("/welcome/replan", fresh), null);
  assert.equal(redirectFor("/", fresh), "/welcome/name");
  assert.equal(redirectFor("/welcome", fresh), "/welcome/name");
});

test("an onboarded account never sees Welcome or onboarding again", () => {
  assert.equal(redirectFor("/", done), null);
  assert.equal(redirectFor("/dev/gallery", done), null);
  assert.equal(redirectFor("/welcome", done), "/");
  assert.equal(redirectFor("/welcome/name", done), "/");
});

test("clientIp prefers the first forwarded address", () => {
  const h = (m: Record<string, string>) => ({ get: (k: string) => m[k] ?? null });
  assert.equal(clientIp(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
  assert.equal(clientIp(h({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
  assert.equal(clientIp(h({})), "unknown");
});
