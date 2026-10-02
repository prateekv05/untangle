import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadPrompt } from "./prompts";

test("generated prompts match prompts/*.md (run npm run prompts if this fails)", () => {
  for (const name of ["understand", "plan", "replan"] as const) {
    assert.equal(loadPrompt(name), readFileSync(`prompts/${name}.md`, "utf8"), name);
  }
});

test("the generator is deterministic", () => {
  execFileSync("node", ["scripts/gen-prompts.mjs"]);
  assert.equal(loadPrompt("understand").includes("untrusted"), true);
});
