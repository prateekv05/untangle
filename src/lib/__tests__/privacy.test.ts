/** Guards the rules in CLAUDE.md: secrets stay on the server, and nothing personal reaches logs or prompts. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const SRC = join(process.cwd(), "src");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
const files = walk(SRC).map((path) => ({ path: path.slice(SRC.length + 1), text: readFileSync(path, "utf8") }));

test("client components never read server secrets or the environment", () => {
  const bad = files.filter((f) => /^\s*["']use client["']/.test(f.text) && /process\.env|AUTH_SECRET|AUTH_GOOGLE_SECRET|DATABASE_URL|API_KEY/.test(f.text));
  assert.deepEqual(bad.map((f) => f.path), []);
});

test("the only logging is the name-only API error line and the AI call log", () => {
  const logs = files.flatMap((f) => f.text.split("\n").filter((l) => /console\.(log|error|warn|info|debug)/.test(l)).map((l) => `${f.path}: ${l.trim()}`));
  assert.equal(logs.length, 2, logs.join("\n"));
  assert.match(logs[0], /^lib\/ai\/log\.ts: export const logAiCall = \(entry: AiLog\): void => console\.log\(JSON\.stringify\(entry\)\);/);
  assert.match(logs[1], /^lib\/api\.ts: console\.error\("api error:", e instanceof Error \? e\.name : "unknown"\);/);
});

test("prompts and AI code never mention the user's name or gender", () => {
  const dir = join(process.cwd(), "prompts");
  const md = readdirSync(dir).filter((f) => f.endsWith(".md")).filter((f) => /\b(gender|user'?s name|\{\{\s*name)/i.test(readFileSync(join(dir, f), "utf8")));
  assert.deepEqual(md, []);
  const ai = files.filter((f) => f.path.startsWith("lib/ai/"));
  const bad = ai.filter((f) => /\b(gender|user\.name|userName|passwordHash)\b/.test(f.text));
  assert.deepEqual(bad.map((f) => f.path), []);
});
