import { errorResponse, readJson } from "@/lib/api";
import { PlanBody } from "@/lib/api-schemas";
import { modelPlanGenerator, planStart } from "@/lib/ai/plan";
import { runPlanPipeline } from "@/lib/ai/pipeline";
import { readModelOverride } from "@/lib/ai/override";
import { getEnv } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { localClock } from "@/lib/timezone";
import { activeTasks, keptBlocksFor } from "@/lib/day-edit";
import { getDayById, getDayState, getSettings, incrementAiUsage, savePlan, setDayMode, syncDayTasks } from "@/db/queries";
import { NotFoundError } from "@/db/queries/helpers";

/**
 * POST /api/plan { dayId, tasks }: save the tasks as the user left them, plan the day, save plan version 1.
 * The plan always passes validatePlan() before it is saved or returned (model, one repair, then the fallback planner).
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const env = getEnv();
    const body = PlanBody.parse(await readJson(request));
    const day = await getDayById(user.id, body.dayId);
    if (!day) throw new NotFoundError("Day");
    const settings = await getSettings(user.id);
    const clock = localClock(settings.timezone);
    await incrementAiUsage(user.id, clock.date, env.DAILY_AI_CALL_LIMIT);

    if (body.mode !== day.mode) await setDayMode(user.id, day.id, body.mode);
    await syncDayTasks(user.id, day.id, body.tasks);
    // Tasks already finished on this day (a new dump added to a day under way) keep their blocks; for a fresh day there are none.
    const state = await getDayState(user.id, day.id);
    if (!state) throw new NotFoundError("Day");
    const tasks = activeTasks(state.rows);
    const done = state.rows.filter((r) => r.status === "done").map((r) => r.id);
    const planFrom = planStart(day.date === clock.date, clock.time, settings);
    const result = await runPlanPipeline({ tasks, settings, mode: body.mode, planFrom, keptBlocks: keptBlocksFor(state.plan?.snapshot ?? null, state.rows) }, modelPlanGenerator(await readModelOverride()));

    const { version } = await savePlan(user.id, day.id, "initial", null, result.plan, result.source, result.model);
    return Response.json({ plan: result.plan, tasks, done, mode: body.mode, source: result.source, model: result.model, version, plannedAt: clock.time });
  } catch (e) {
    return errorResponse(e);
  }
}
