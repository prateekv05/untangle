/**
 * AI evals: run evals/cases.json through the real pipeline and check properties in code (never model-graded).
 * `pipeline` cases run understand -> auto-answers -> plan pipeline (validate, repair, fallback). `replan` cases run their base case,
 * mark `doneTitles` finished, then interpret the instruction and re-plan from `at` (the same steps as POST /api/replan, without the database).
 *
 *   npm run eval -- --plan=openai:gpt-6.1-sol --fast=openai:gpt-6-luna --runs=3
 *   npm run eval -- --case=injection
 *
 * Options: --fast=provider:model and --plan=provider:model (default AI_MODEL_FAST / AI_MODEL_PLAN), --runs=N (default 3),
 * --case=id, --type=pipeline|replan, --concurrency=N (default 3).
 */
import { readFileSync } from "node:fs";
import { configFromEnv, resolveModelSpec } from "../src/lib/ai/models";
import { runPlanPipeline } from "../src/lib/ai/pipeline";
import { modelPlanGenerator, planStart } from "../src/lib/ai/plan";
import { interpretReplan } from "../src/lib/ai/replan";
import { activeTasks, keptBlocksFor, type DayRow } from "../src/lib/day-edit";
import { diffStarts } from "../src/lib/planner";
import { applyReplanChanges, planReplanChanges } from "../src/lib/replan";
import { understand, type UnderstandInput } from "../src/lib/ai/understand";
import type { Block, Plan, Settings, Task, UnderstandResult } from "../src/lib/schemas";
import { toMin } from "../src/lib/time";
import { validatePlan, type ValidateContext } from "../src/lib/validate-plan";

try { process.loadEnvFile(".env.local"); } catch { /* the variables may already be set */ }

type Assertion = { a: string; [k: string]: unknown };
type Answer = { match: string; due?: Task["due"]; durationMin?: number; time?: string };
type Case = {
  id: string; desc: string; type: string; input: { text: string; today: string; now: string; mode: "workday" | "dayoff" }; answers?: Answer[]; expect: Assertion[];
  /** replan only */
  base?: string; at?: string; doneTitles?: string[]; instruction?: string;
};
type Cases = { defaultSettings: Settings; cases: Case[] };

/** Re-plan only: they need the plan from before the sentence. */
const REPLAN_ONLY = new Set(["kept", "wasPillsPresent"]);

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, ...v] = a.slice(2).split("="); return [k, v.join("=")]; }));
const runs = Number(args.runs ?? 3);
const concurrency = Number(args.concurrency ?? 3);

const lower = (s: unknown) => String(s).toLowerCase();
const titleHas = (title: string, needle: unknown) => lower(title).includes(lower(needle));
// A deadline the user actually stated: due, by <day>, today/tomorrow, this week, deadline.
const STATES_DUE = /\b(due|deadline|today|tomorrow|tonight|this week|next week|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|end of))\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

/** What an assertion looks at: the understand output with answers applied, and the validated plan. */
export type Subject = {
  result: UnderstandResult; plan: Plan; mode: "workday" | "dayoff"; settings: Settings;
  /** Re-plan only: the plan before the sentence, the finished blocks, the tasks moved to tomorrow, the tasks in play and what validatePlan was given. */
  replan?: { before: Plan; kept: Block[]; movedIds: Set<string>; active: Task[]; validate: ValidateContext };
};

const isFixedKindIn = (r: UnderstandResult, taskId: string) => r.tasks.find((t) => t.id === taskId)?.kind === "fixed";
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Returns null when the assertion holds, otherwise why it failed. */
export function check(a: Assertion, subject: Subject, text: string): string | null {
  const { result: r, plan, mode, settings, replan } = subject;
  const keptIds = new Set((replan?.kept ?? []).map((b) => b.taskId));
  const flexible = plan.blocks.filter((b) => !isFixedKindIn(r, b.taskId) && !keptIds.has(b.taskId));
  const find = (needle: unknown) => r.tasks.find((t) => titleHas(t.title, needle));
  const blockOf = (needle: unknown) => { const t = find(needle); return t ? plan.blocks.find((b) => b.taskId === t.id) : undefined; };
  const sorted = [...plan.blocks].sort((x, y) => toMin(x.start) - toMin(y.start));
  const planStrings = [...plan.blocks.flatMap((b) => [b.reason, b.hop ?? ""]), ...plan.decisions, plan.note ?? "", ...plan.dropped.map((d) => d.why)];
  switch (a.a) {
    case "taskCount":
      return r.tasks.length >= Number(a.min) && r.tasks.length <= Number(a.max) ? null : `expected ${a.min} to ${a.max} tasks, got ${r.tasks.length}`;
    case "planFor":
      return r.planFor === a.value ? null : `expected planFor ${a.value}, got ${r.planFor}`;
    case "taskHas": {
      const t = find(a.titleContains);
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
      return lower(JSON.stringify({ r, plan })).includes(lower(a.text)) ? `output contains "${a.text}"` : null;
    case "noEmojiOrExclamation": {
      const strings = [...r.tasks.map((t) => t.title), ...r.questions.map((q) => q.prompt), ...r.groupings.flatMap((g) => [g.label, g.why]), ...planStrings];
      return strings.some((s) => EMOJI.test(s) || s.includes("!")) ? "emoji or exclamation mark in output" : null;
    }
    case "validPlan": {
      const errs = replan ? validatePlan(plan, replan.active, settings, replan.validate) : validatePlan(plan, r.tasks, settings, { mode });
      return errs.length === 0 ? null : errs.join("; ");
    }
    case "oneOuting": {
      const titles = a.titles as string[];
      const blocks = titles.map((t) => blockOf(t));
      const missing = titles.filter((_, i) => !blocks[i]);
      if (missing.length) return `not scheduled: ${missing.join(", ")}`;
      const ids = new Set(blocks.map((b) => b!.outingId));
      if (ids.size !== 1 || ids.has(null)) return `${titles.join(", ")} do not share one outingId`;
      const at = blocks.map((b) => sorted.indexOf(b!)).sort((x, y) => x - y);
      return at[at.length - 1] - at[0] === at.length - 1 ? null : `${titles.join(", ")} are not back to back`;
    }
    case "before": {
      const [x, y] = [blockOf(a.first), blockOf(a.second)];
      if (!x || !y) return `"${!x ? a.first : a.second}" is not scheduled`;
      return toMin(x.start) < toMin(y.start) ? null : `"${a.first}" starts ${x.start}, not before "${a.second}" at ${y.start}`;
    }
    case "startsAt":
    case "startsAfter": {
      const b = blockOf(a.title);
      if (!b) return `"${a.title}" is not scheduled`;
      if (a.a === "startsAt") return b.start === a.time ? null : `"${a.title}" starts ${b.start}, expected ${a.time}`;
      return toMin(b.start) >= toMin(String(a.time)) ? null : `"${a.title}" starts ${b.start}, expected ${a.time} or later`;
    }
    case "noStartBefore": {
      const early = plan.blocks.find((b) => !(a.excludeKept && keptIds.has(b.taskId)) && toMin(b.start) < toMin(String(a.time)));
      return early ? `a block starts ${early.start}, before ${a.time}` : null;
    }
    case "maxScheduledMinutes": {
      const total = flexible.reduce((n, b) => n + b.durationMin, 0);
      return total <= Number(a.value) ? null : `${total} min of non-fixed work, limit ${a.value}`;
    }
    case "afternoonLoadMax": {
      const total = flexible.filter((b) => toMin(b.start) >= toMin(String(a.after))).reduce((n, b) => n + b.durationMin, 0);
      return total <= Number(a.max) ? null : `${total} min of non-fixed work after ${a.after}, limit ${a.max} (day ends ${fmt(toMin(settings.sleep))})`;
    }
    case "hasDropped":
      return plan.dropped.length > 0 ? null : "nothing was dropped";
    case "dropReasonsPresent":
      return plan.dropped.every((d) => d.why.trim().length > 0) ? null : "a dropped task has no reason";
    case "dropped":
    case "notDropped": {
      const t = find(a.titleContains);
      if (!t) return `no task contains "${a.titleContains}"`;
      const isDropped = plan.dropped.some((d) => d.taskId === t.id) || !!replan?.movedIds.has(t.id);
      if (a.a === "dropped") return isDropped ? null : `"${t.title}" was not dropped`;
      return isDropped ? `"${t.title}" was dropped` : null;
    }
    case "kept": {
      if (!replan) return "kept needs a re-plan";
      const t = find(a.titleContains);
      const was = t && replan.before.blocks.find((b) => b.taskId === t.id);
      const now = t && plan.blocks.find((b) => b.taskId === t.id);
      if (!t || !was) return `no finished block for "${a.titleContains}"`;
      return now && JSON.stringify(now) === JSON.stringify(was) ? null : `"${t.title}" moved from ${was.start} to ${now?.start ?? "nowhere"}`;
    }
    case "wasPillsPresent":
      return replan && Object.keys(diffStarts(replan.before, plan)).length > 0 ? null : "no block changed its start";
    case "reasonsPresent":
      return plan.blocks.every((b) => b.reason.trim().length > 0) ? null : "a block has no reason";
    default:
      return `unknown assertion ${a.a}`;
  }
}

/** Applies the case's auto-answers to the tasks the model asked about. Questions nobody answers keep the model's estimate. */
export function applyAnswers(r: UnderstandResult, answers: Answer[] = []): UnderstandResult {
  const tasks = r.tasks.map((t) => {
    let next = t;
    for (const ans of answers) {
      if (!titleHas(t.title, ans.match)) continue;
      const asked = (type: string) => r.questions.some((q) => q.taskId === t.id && q.type === type);
      if (ans.due && asked("due")) next = { ...next, due: ans.due };
      if (ans.durationMin && asked("duration")) next = { ...next, durationMin: ans.durationMin, durationSource: "user" };
      if (ans.time && asked("time")) next = { ...next, fixedStart: ans.time, durationSource: "user" };
    }
    return next;
  });
  return { ...r, tasks };
}

const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : 0; };

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => { for (let x = queue.shift(); x !== undefined; x = queue.shift()) await fn(x); }));
}

type Outcome = { passed: number; fallbacks: number; fails: string[] };

async function main() {
  const { defaultSettings, cases }: Cases = JSON.parse(readFileSync("evals/cases.json", "utf8"));
  const { getEnv } = await import("../src/lib/env");
  const config = configFromEnv(getEnv());
  const override = { ...(args.fast ? { fast: args.fast } : {}), ...(args.plan ? { plan: args.plan } : {}) };
  const fastModel = resolveModelSpec("fast", config, override).spec;
  const planModel = resolveModelSpec("plan", config, override).spec;
  if (args.fast && fastModel !== args.fast) throw new Error(`${args.fast} is not on AI_MODEL_ALLOWLIST`);
  if (args.plan && planModel !== args.plan) throw new Error(`${args.plan} is not on AI_MODEL_ALLOWLIST`);

  const wanted = (c: Case) => (!args.case || c.id === args.case) && (!args.type || c.type === args.type);
  const runnable = cases.filter((c) => (c.type === "pipeline" || c.type === "replan") && wanted(c));
  console.log(`evals: understand and interpret on ${fastModel}, plan on ${planModel}: ${runnable.length} cases x ${runs} runs\n`);

  const generate = modelPlanGenerator(override);
  const jobs = runnable.flatMap((c) => Array.from({ length: runs }, (_, i) => ({ c, run: i + 1 })));
  const understandMs: number[] = [];
  const planMs: number[] = [];
  const replanMs: number[] = [];
  const tokens = { in: 0, out: 0 };
  const outcomes = new Map<string, Outcome>();
  let planRuns = 0;
  let fallbacks = 0;
  let repaired = 0;
  const addTokens = (i: number | null, o: number | null) => { tokens.in += i ?? 0; tokens.out += o ?? 0; };

  /** Dump -> understand -> answers -> plan, the same as the pipeline cases. */
  const runBase = async (c: Case, countPlan: boolean) => {
    const input: UnderstandInput = { text: c.input.text, today: c.input.today, now: c.input.now, timezone: defaultSettings.timezone, settings: defaultSettings, presets: [] };
    const u = await understand(input, override);
    understandMs.push(u.meta.latencyMs);
    addTokens(u.meta.inputTokens, u.meta.outputTokens);
    const result = applyAnswers(u.result, c.answers);
    const pipeline = await runPlanPipeline({ tasks: result.tasks, settings: defaultSettings, mode: c.input.mode, planFrom: planStart(result.planFor === "today", c.input.now, defaultSettings) }, generate, "eval");
    addTokens(pipeline.inputTokens, pipeline.outputTokens);
    if (countPlan) { planMs.push(pipeline.latencyMs); planRuns++; if (pipeline.source === "fallback") fallbacks++; if (pipeline.repaired) repaired++; }
    return { result, pipeline };
  };

  /** Base day, finished tasks, then the same steps as POST /api/replan. */
  const runReplan = async (c: Case) => {
    const base = cases.find((x) => x.id === c.base);
    if (!base) throw new Error(`unknown base case ${c.base}`);
    const { result, pipeline: first } = await runBase(base, false);
    const done = (title: string) => (c.doneTitles ?? []).some((d) => titleHas(title, d));
    const rows: DayRow[] = result.tasks.map((t) => ({ ...t, status: done(t.title) ? "done" : "open", movedTo: null }));
    const at = c.at!;
    const started = Date.now();
    const { constraints, meta } = await interpretReplan({
      instruction: c.instruction!, now: at, currentPlan: first.plan,
      tasks: rows.map((r) => ({ id: r.id, title: r.title, status: r.status as "open" | "done", location: r.location, kind: r.kind, durationMin: r.durationMin })),
    }, override);
    addTokens(meta.inputTokens, meta.outputTokens);
    const changes = planReplanChanges(constraints, rows, first.plan, toMin(at));
    const after = applyReplanChanges(rows, changes, changes.newEvents.map((_, i) => `ev${i + 1}`), "tomorrow");
    const active = activeTasks(after);
    const kept = keptBlocksFor(first.plan, after);
    const planFrom = Math.max(changes.minStart, toMin(defaultSettings.wake));
    const pipeline = await runPlanPipeline({ tasks: active, settings: defaultSettings, mode: base.input.mode, planFrom, keptBlocks: kept, limits: changes.limits }, generate, "eval-replan");
    replanMs.push(Date.now() - started);
    addTokens(pipeline.inputTokens, pipeline.outputTokens);
    planRuns++;
    if (pipeline.source === "fallback") fallbacks++;
    if (pipeline.repaired) repaired++;
    const validate: ValidateContext = {
      mode: base.input.mode, minStart: planFrom, keptTaskIds: kept.map((b) => b.taskId),
      durationOverrides: changes.limits.durationOverrides, capacityMin: changes.limits.capacityMin, lighterAfter: changes.limits.lighterAfter, mustFinishTaskIds: changes.limits.mustFinishTaskIds,
    };
    const movedIds = new Set(after.filter((r) => r.status === "moved").map((r) => r.id));
    const subject: Subject = { result: { ...result, tasks: after.map(({ status: _s, movedTo: _m, ...t }) => t) }, plan: pipeline.plan, mode: base.input.mode, settings: defaultSettings, replan: { before: first.plan, kept, movedIds, active, validate } };
    return { subject, source: pipeline.source, text: c.instruction! };
  };

  await pool(jobs, concurrency, async ({ c, run }) => {
    const o = outcomes.get(c.id) ?? { passed: 0, fallbacks: 0, fails: [] };
    outcomes.set(c.id, o);
    try {
      let subject: Subject, source: string, text: string;
      if (c.type === "replan") ({ subject, source, text } = await runReplan(c));
      else {
        const { result, pipeline } = await runBase(c, true);
        subject = { result, plan: pipeline.plan, mode: c.input.mode, settings: defaultSettings };
        source = pipeline.source;
        text = c.input.text;
      }
      if (source === "fallback") o.fallbacks++;
      const failures = c.expect.filter((e) => c.type === "replan" || !REPLAN_ONLY.has(e.a)).map((e) => check(e, subject, text)).filter((x): x is string => x !== null);
      if (failures.length === 0) o.passed++;
      else o.fails.push(`run ${run} (${source}): ${failures.join("; ")}`);
    } catch (e) {
      o.fails.push(`run ${run}: call failed (${e instanceof Error ? e.name : "unknown"})`);
    }
  });

  let passed = 0;
  for (const c of runnable) {
    const o = outcomes.get(c.id)!;
    passed += o.passed;
    console.log(`${o.passed === runs ? "PASS" : "FAIL"}  ${c.id}  ${o.passed}/${runs}${o.fallbacks ? `  (${o.fallbacks} fallback)` : ""}`);
    o.fails.forEach((f) => console.log(`        ${f}`));
  }
  const total = runnable.length * runs;
  const rate = total ? (passed / total) * 100 : 0;
  const fallbackRate = planRuns ? (fallbacks / planRuns) * 100 : 0;
  console.log(`\n${planModel} (plan) / ${fastModel} (understand)`);
  console.log(`pass rate ${rate.toFixed(1)}% (${passed}/${total})`);
  console.log(`fallback rate ${fallbackRate.toFixed(1)}% (${fallbacks}/${planRuns}), repaired by the model ${repaired}`);
  if (replanMs.length) console.log(`re-plan latency (interpret + plan) p50 ${pct(replanMs, 50)} ms, p95 ${pct(replanMs, 95)} ms`);
  console.log(`plan latency p50 ${pct(planMs, 50)} ms, p95 ${pct(planMs, 95)} ms; understand p50 ${pct(understandMs, 50)} ms, p95 ${pct(understandMs, 95)} ms`);
  console.log(`tokens in ${tokens.in}, out ${tokens.out}`);
  process.exitCode = rate >= 95 ? 0 : 1;
}

if (process.argv[1]?.endsWith("eval.ts")) void main();
