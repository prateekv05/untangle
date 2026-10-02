/**
 * AI evals: run evals/cases.json through the real pipeline and check properties in code (never model-graded).
 * Phase 4 covers `pipeline` cases through the understand step only; plan and re-plan assertions are skipped until Phases 5 and 7.
 *
 *   npm run eval -- --fast=openai:gpt-6-luna --runs=3
 *   npm run eval -- --case=injection
 *
 * Options: --fast=provider:model (default AI_MODEL_FAST), --plan= (accepted, unused until Phase 5), --runs=N (default 3),
 * --case=id, --concurrency=N (default 3).
 */
import { readFileSync } from "node:fs";
import { configFromEnv, resolveModelSpec } from "../src/lib/ai/models";
import { understand, type UnderstandInput } from "../src/lib/ai/understand";
import type { Settings, UnderstandResult } from "../src/lib/schemas";

try { process.loadEnvFile(".env.local"); } catch { /* the variables may already be set */ }

type Assertion = { a: string; [k: string]: unknown };
type Case = { id: string; desc: string; type: string; input: { text: string; today: string; now: string; mode: string }; expect: Assertion[] };
type Cases = { defaultSettings: Settings; cases: Case[] };

const SUPPORTED = new Set(["taskCount", "taskHas", "questionAsked", "noQuestion", "noInventedDue", "planFor", "noTaskContains", "noOutputContains", "noEmojiOrExclamation"]);

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, ...v] = a.slice(2).split("="); return [k, v.join("=")]; }));
const runs = Number(args.runs ?? 3);
const concurrency = Number(args.concurrency ?? 3);

const lower = (s: unknown) => String(s).toLowerCase();
const titleHas = (title: string, needle: unknown) => lower(title).includes(lower(needle));
// A deadline the user actually stated: due, by <day>, today/tomorrow, this week, deadline.
const STATES_DUE = /\b(due|deadline|today|tomorrow|tonight|this week|next week|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|end of))\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

/** Returns null when the assertion holds, otherwise why it failed. */
export function check(a: Assertion, r: UnderstandResult, text: string, today: string): string | null {
  const find = () => r.tasks.find((t) => titleHas(t.title, a.titleContains));
  switch (a.a) {
    case "taskCount":
      return r.tasks.length >= Number(a.min) && r.tasks.length <= Number(a.max) ? null : `expected ${a.min} to ${a.max} tasks, got ${r.tasks.length}`;
    case "planFor":
      return r.planFor === a.value ? null : `expected planFor ${a.value}, got ${r.planFor}`;
    case "taskHas": {
      const t = find();
      if (!t) return `no task contains "${a.titleContains}" (got ${r.tasks.map((x) => x.title).join(" | ")})`;
      for (const k of ["location", "kind", "fixedStart", "due", "durationMin", "durationSource"] as const) {
        if (k in a && t[k] !== a[k]) return `"${t.title}".${k} is ${t[k]}, expected ${a[k]}`;
      }
      return null;
    }
    case "noTaskContains":
      return r.tasks.some((t) => titleHas(t.title, a.text)) ? `a task still contains "${a.text}"` : null;
    case "questionAsked":
    case "noQuestion": {
      const hit = r.questions.some((q) => q.type === a.type && titleHas(r.tasks.find((t) => t.id === q.taskId)?.title ?? "", a.titleContains));
      if (a.a === "questionAsked") return hit ? null : `no ${a.type} question about "${a.titleContains}"`;
      return hit ? `unexpected ${a.type} question about "${a.titleContains}"` : null;
    }
    case "noInventedDue": {
      if (STATES_DUE.test(text)) return null;
      const t = r.tasks.find((x) => x.due !== null);
      return t ? `"${t.title}" has due ${t.due} but the text states none` : null;
    }
    case "noOutputContains":
      return lower(JSON.stringify(r)).includes(lower(a.text)) ? `output contains "${a.text}"` : null;
    case "noEmojiOrExclamation": {
      const strings = [...r.tasks.map((t) => t.title), ...r.questions.map((q) => q.prompt), ...r.groupings.flatMap((g) => [g.label, g.why])];
      return strings.some((s) => EMOJI.test(s) || s.includes("!")) ? "emoji or exclamation mark in output" : null;
    }
    default:
      return null;
  }
}

const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : 0; };

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => { for (let x = queue.shift(); x !== undefined; x = queue.shift()) await fn(x); }));
}

async function main() {
  const { defaultSettings, cases }: Cases = JSON.parse(readFileSync("evals/cases.json", "utf8"));
  const { getEnv } = await import("../src/lib/env");
  const config = configFromEnv(getEnv());
  const override = args.fast ? { fast: args.fast } : {};
  const model = resolveModelSpec("fast", config, override).spec;
  if (args.fast && model !== args.fast) throw new Error(`${args.fast} is not on AI_MODEL_ALLOWLIST`);

  const selected = cases.filter((c) => c.type === "pipeline" && (!args.case || c.id === args.case));
  const runnable = selected.filter((c) => c.expect.some((e) => SUPPORTED.has(e.a)));
  const skipped = selected.filter((c) => !runnable.includes(c));
  console.log(`understand evals on ${model}: ${runnable.length} cases x ${runs} runs${skipped.length ? ` (no understand checks yet: ${skipped.map((c) => c.id).join(", ")})` : ""}\n`);

  const jobs = runnable.flatMap((c) => Array.from({ length: runs }, (_, i) => ({ c, run: i + 1 })));
  const latencies: number[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  const outcomes = new Map<string, { passed: number; fails: string[] }>();

  await pool(jobs, concurrency, async ({ c, run }) => {
    const input: UnderstandInput = { text: c.input.text, today: c.input.today, now: c.input.now, timezone: defaultSettings.timezone, settings: defaultSettings, presets: [] };
    const o = outcomes.get(c.id) ?? { passed: 0, fails: [] };
    outcomes.set(c.id, o);
    try {
      const { result, meta } = await understand(input, override);
      latencies.push(meta.latencyMs);
      tokensIn += meta.inputTokens ?? 0;
      tokensOut += meta.outputTokens ?? 0;
      const failures = c.expect.filter((e) => SUPPORTED.has(e.a)).map((e) => check(e, result, c.input.text, c.input.today)).filter((x): x is string => x !== null);
      if (failures.length === 0) o.passed++;
      else o.fails.push(`run ${run}: ${failures.join("; ")}`);
    } catch (e) {
      o.fails.push(`run ${run}: call failed (${e instanceof Error ? e.name : "unknown"})`);
    }
  });

  let passed = 0;
  for (const c of runnable) {
    const o = outcomes.get(c.id)!;
    passed += o.passed;
    console.log(`${o.passed === runs ? "PASS" : "FAIL"}  ${c.id}  ${o.passed}/${runs}`);
    o.fails.forEach((f) => console.log(`        ${f}`));
  }
  const total = runnable.length * runs;
  const rate = total ? (passed / total) * 100 : 0;
  console.log(`\npass rate ${rate.toFixed(1)}% (${passed}/${total})  latency p50 ${pct(latencies, 50)} ms, p95 ${pct(latencies, 95)} ms  tokens in ${tokensIn}, out ${tokensOut}`);
  process.exitCode = rate >= 95 ? 0 : 1;
}

if (process.argv[1]?.endsWith("eval.ts")) void main();
