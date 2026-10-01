import test from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://u:p@h/db",
  AI_MODEL_PLAN: "anthropic:claude-sonnet-5-5",
  AI_MODEL_FAST: "openai:gpt-6-luna",
  AI_MODEL_ALLOWLIST: "anthropic:claude-sonnet-5-5, openai:gpt-6-luna",
  DAILY_AI_CALL_LIMIT: "40",
};

test("parseEnv accepts a valid environment and coerces numbers and lists", () => {
  const env = parseEnv(valid);
  assert.equal(env.DAILY_AI_CALL_LIMIT, 40);
  assert.deepEqual(env.AI_MODEL_ALLOWLIST, ["anthropic:claude-sonnet-5-5", "openai:gpt-6-luna"]);
  assert.equal(env.MAX_DUMP_CHARS, 4000);
});

test("parseEnv fails fast with a readable list of problems", () => {
  assert.throws(
    () => parseEnv({ ...valid, DATABASE_URL: undefined, AI_MODEL_PLAN: "sonnet" }),
    (e: Error) => e.message.includes("DATABASE_URL") && e.message.includes("AI_MODEL_PLAN") && e.message.includes(".env.example"),
  );
});
