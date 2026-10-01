import assert from "node:assert/strict";
import { test } from "node:test";
import { isExplainer, isStep, nextStep, prevStep, stepNumber } from "../onboarding";

test("steps run name, gender, dump, plan, replan", () => {
  assert.equal(stepNumber("name"), 1);
  assert.equal(stepNumber("replan"), 5);
  assert.equal(prevStep("name"), null);
  assert.equal(prevStep("gender"), "name");
  assert.equal(nextStep("dump"), "plan");
  assert.equal(nextStep("replan"), null);
});

test("only the three explainers can be skipped; name and gender cannot", () => {
  assert.deepEqual((["name", "gender", "dump", "plan", "replan"] as const).filter(isExplainer), ["dump", "plan", "replan"]);
});

test("isStep rejects unknown paths", () => {
  assert.equal(isStep("name"), true);
  assert.equal(isStep("admin"), false);
});
