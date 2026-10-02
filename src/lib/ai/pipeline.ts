/**
 * The safety net around the plan call: model -> Zod -> validatePlan -> one repair call -> planDay().
 * The caller always gets a valid plan; `source` says who made it. Never logs user text.
 */
import { logAiCall } from "./log";
import type { PlanGeneration, PlanGenerator, PlanInput, PlanRepair } from "./plan";
import { planDay } from "../planner";
import type { Plan } from "../schemas";
import { validatePlan } from "../validate-plan";

export type PipelineResult = {
  plan: Plan;
  source: "llm" | "fallback";
  /** The model that produced the plan; null for the fallback. */
  model: string | null;
  repaired: boolean;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  /** Validator messages from every rejected attempt (task titles only, no transcripts). */
  validatorErrors: string[];
};

export async function runPlanPipeline(input: PlanInput, generate: PlanGenerator, route = "plan"): Promise<PipelineResult> {
  const started = Date.now();
  const validatorErrors: string[] = [];
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let lastModel: string | null = null;
  let repair: PlanRepair | undefined;
  let failure: string | undefined;

  const add = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));
  const check = (plan: Plan) => validatePlan(plan, input.tasks, input.settings, { mode: input.mode, minStart: input.planFrom });

  for (let attempt = 0; attempt < 2; attempt++) {
    let g: PlanGeneration;
    try {
      g = await generate(input, repair);
    } catch (e) {
      // Name only: messages can echo the prompt. A failed call has no plan to repair from, so the retry starts fresh.
      failure = e instanceof Error ? e.name : "unknown";
      continue;
    }
    lastModel = g.model;
    inputTokens = add(inputTokens, g.inputTokens);
    outputTokens = add(outputTokens, g.outputTokens);
    const errors = check(g.plan);
    if (errors.length === 0) {
      const result: PipelineResult = { plan: g.plan, source: "llm", model: g.model, repaired: attempt > 0, latencyMs: Date.now() - started, inputTokens, outputTokens, validatorErrors };
      log(route, result);
      return result;
    }
    validatorErrors.push(...errors);
    repair = { previous: g.plan, errors };
  }

  const plan = planDay(input.tasks, input.settings, { mode: input.mode, minStart: input.planFrom });
  const result: PipelineResult = { plan, source: "fallback", model: null, repaired: false, latencyMs: Date.now() - started, inputTokens, outputTokens, validatorErrors };
  log(route, result, lastModel, failure);
  return result;
}

function log(route: string, r: PipelineResult, model: string | null = r.model, error?: string): void {
  logAiCall({ route, role: "plan", model: model ?? "none", latencyMs: r.latencyMs, inputTokens: r.inputTokens, outputTokens: r.outputTokens, error, source: r.source, repaired: r.repaired, validatorErrors: r.validatorErrors });
}
