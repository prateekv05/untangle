import assert from "node:assert/strict";
import { test } from "node:test";
import { installHint, isIos } from "./install";

const base = { standalone: false, ios: false, canPrompt: false, dismissed: false };

test("Chromium with a prompt to trigger shows the install button", () => {
  assert.equal(installHint({ ...base, canPrompt: true }), "prompt");
});

test("iOS has no prompt, so it shows the steps", () => {
  assert.equal(installHint({ ...base, ios: true }), "ios");
});

test("nothing to show on a browser that cannot install", () => {
  assert.equal(installHint(base), null);
});

test("hidden once installed or dismissed", () => {
  assert.equal(installHint({ ...base, canPrompt: true, standalone: true }), null);
  assert.equal(installHint({ ...base, ios: true, dismissed: true }), null);
});

test("detects iPhone and iPadOS that reports as a Mac", () => {
  assert.equal(isIos("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone", 5), true);
  assert.equal(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5), true);
  assert.equal(isIos("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0), false);
  assert.equal(isIos("Mozilla/5.0 (Linux; Android 15)", "Linux armv8l", 5), false);
});
