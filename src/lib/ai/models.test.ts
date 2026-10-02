import test from "node:test";
import assert from "node:assert/strict";
import { ModelConfigError, parseModelSpec, parseOverride, resolveModelSpec, serializeOverride, type ModelConfig } from "./models";

const config: ModelConfig = {
  defaults: { plan: "anthropic:claude-sonnet-5-5", fast: "anthropic:claude-haiku-4-5-20251001" },
  allowlist: ["anthropic:claude-sonnet-5-5", "anthropic:claude-haiku-4-5-20251001", "openai:gpt-6.1-sol", "openai:gpt-6-luna"],
};

test("parseModelSpec splits provider and id, including dots and dashes", () => {
  assert.deepEqual(parseModelSpec("openai:gpt-6.1-sol"), { provider: "openai", id: "gpt-6.1-sol", spec: "openai:gpt-6.1-sol" });
  assert.equal(parseModelSpec(" anthropic:claude-haiku-4-5-20251001 ").id, "claude-haiku-4-5-20251001");
});

test("parseModelSpec rejects unknown providers and missing ids", () => {
  for (const bad of ["sonnet", "google:gemini", "openai:", ":gpt", "openai:gpt 6", ""]) {
    assert.throws(() => parseModelSpec(bad), ModelConfigError, bad);
  }
});

test("without an override the env default is used", () => {
  assert.equal(resolveModelSpec("plan", config).spec, "anthropic:claude-sonnet-5-5");
  assert.equal(resolveModelSpec("fast", config).spec, "anthropic:claude-haiku-4-5-20251001");
});

test("an allowlisted override wins, per role", () => {
  const o = { fast: "openai:gpt-6-luna" };
  assert.equal(resolveModelSpec("fast", config, o).spec, "openai:gpt-6-luna");
  assert.equal(resolveModelSpec("plan", config, o).spec, "anthropic:claude-sonnet-5-5");
});

test("an override outside the allowlist or malformed is ignored", () => {
  assert.equal(resolveModelSpec("plan", config, { plan: "openai:gpt-9" }).spec, config.defaults.plan);
  assert.equal(resolveModelSpec("plan", config, { plan: "nonsense" }).spec, config.defaults.plan);
});

test("parseOverride tolerates a missing, broken or wrongly shaped cookie", () => {
  assert.deepEqual(parseOverride(undefined), {});
  assert.deepEqual(parseOverride("{not json"), {});
  assert.deepEqual(parseOverride('{"plan":42}'), {});
  assert.deepEqual(parseOverride(serializeOverride({ plan: "openai:gpt-6.1-sol" })), { plan: "openai:gpt-6.1-sol" });
});

test("models that reject temperature get none", async () => {
  const { callSettings } = await import("./models");
  assert.deepEqual(callSettings(parseModelSpec("anthropic:claude-sonnet-5-5")), {});
  assert.deepEqual(callSettings(parseModelSpec("anthropic:claude-haiku-4-5-20251001")), { temperature: 0 });
});

test("OpenAI reasoning models get no temperature either", async () => {
  const { callSettings } = await import("./models");
  assert.deepEqual(callSettings(parseModelSpec("openai:gpt-6.1-sol")), {});
  assert.deepEqual(callSettings(parseModelSpec("openai:gpt-6-luna")), {});
});
