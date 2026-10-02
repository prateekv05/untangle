import test from "node:test";
import assert from "node:assert/strict";
import { runPlanPipeline } from "./pipeline";
import { buildPlanMessage, type PlanGenerator, type PlanInput } from "./plan";
import { planDay } from "../planner";
import { DEFAULT_SETTINGS, type Plan, type Task } from "../schemas";
import { validatePlan } from "../validate-plan";

const task = (id: string, o: Partial<Task> = {}): Task => ({ id, title: id, location: "anywhere", kind: "admin", durationMin: 30, durationSource: "estimated", fixedStart: null, due: null, ...o });
const input: PlanInput = { tasks: [task("a"), task("b", { kind: "deep", durationMin: 90, due: "tomorrow" })], settings: DEFAULT_SETTINGS, mode: "dayoff", planFrom: 8 * 60 };
const good: Plan = planDay(input.tasks, input.settings, { mode: "dayoff", minStart: input.planFrom });
const broken: Plan = { ...good, blocks: good.blocks.slice(1) }; // drops a task without saying so
const gen = (...steps: Array<Plan | Error>): PlanGenerator & { calls: number; repairs: unknown[] } => {
  const g = Object.assign(
    async (_i: PlanInput, repair?: { errors: string[] }) => {
      g.repairs.push(repair);
      const step = steps[Math.min(g.calls++, steps.length - 1)];
      if (step instanceof Error) throw step;
      return { plan: step, model: "anthropic:test", inputTokens: 10, outputTokens: 5 };
    },
    { calls: 0, repairs: [] as unknown[] },
  );
  return g;
};

test("the good plan is valid to begin with", () => assert.deepEqual(validatePlan(good, input.tasks, input.settings, { mode: "dayoff", minStart: input.planFrom }), []));

test("a valid model plan is used as is", async () => {
  const r = await runPlanPipeline(input, gen(good));
  assert.equal(r.source, "llm");
  assert.equal(r.model, "anthropic:test");
  assert.equal(r.repaired, false);
  assert.deepEqual(r.validatorErrors, []);
});

test("an invalid plan is repaired once with the error list", async () => {
  const g = gen(broken, good);
  const r = await runPlanPipeline(input, g);
  assert.equal(r.source, "llm");
  assert.equal(r.repaired, true);
  assert.equal(g.calls, 2);
  assert.ok((g.repairs[1] as { errors: string[] }).errors.length > 0);
  assert.equal(r.inputTokens, 20);
});

test("two bad plans fall back to planDay and the user still gets a valid plan", async () => {
  const r = await runPlanPipeline(input, gen(broken, broken));
  assert.equal(r.source, "fallback");
  assert.equal(r.model, null);
  assert.ok(r.validatorErrors.length > 0);
  assert.deepEqual(validatePlan(r.plan, input.tasks, input.settings, { mode: "dayoff", minStart: input.planFrom }), []);
});

test("a throwing model (bad JSON, timeout) is retried, then falls back", async () => {
  const once = await runPlanPipeline(input, gen(new Error("bad json"), good));
  assert.equal(once.source, "llm");
  const g = gen(new Error("down"));
  const r = await runPlanPipeline(input, g);
  assert.equal(r.source, "fallback");
  assert.equal(g.calls, 2);
});

test("the plan message carries tasks, mode and planFrom, and the errors when repairing", () => {
  const m = buildPlanMessage(input);
  assert.match(m, /"mode":"dayoff"/);
  assert.match(m, /"planFrom":"08:00"/);
  assert.doesNotMatch(m, /errors/);
  assert.match(buildPlanMessage(input, { previous: good, errors: ["x overlaps y"] }), /x overlaps y/);
});

test("finished blocks are kept exactly, the model plans only the open tasks, and the fallback keeps them too", async () => {
  const tasks = [task("a"), task("b"), task("c", { durationMin: 45 })];
  const first = planDay(tasks, DEFAULT_SETTINGS, { mode: "dayoff", minStart: 8 * 60 });
  const keptBlocks = first.blocks.filter((b) => b.taskId === "a");
  const rebuilt: PlanInput = { tasks, settings: DEFAULT_SETTINGS, mode: "dayoff", planFrom: 10 * 60, keptBlocks };
  assert.ok(!buildPlanMessage(rebuilt).includes('"id":"a"'), "the model is not asked to place a finished task");
  assert.ok(buildPlanMessage(rebuilt).includes("keptBlocks"));
  const openOnly = planDay(tasks.filter((t) => t.id !== "a"), DEFAULT_SETTINGS, { mode: "dayoff", minStart: 10 * 60 });
  const r = await runPlanPipeline(rebuilt, gen(openOnly));
  assert.equal(r.source, "llm");
  assert.deepEqual(r.plan.blocks.filter((b) => b.taskId === "a"), keptBlocks);
  const fb = await runPlanPipeline(rebuilt, gen(broken, broken));
  assert.equal(fb.source, "fallback");
  assert.deepEqual(fb.plan.blocks.filter((b) => b.taskId === "a"), keptBlocks);
  assert.ok(fb.plan.blocks.filter((b) => b.taskId !== "a").every((b) => b.start >= "10:00"));
});
