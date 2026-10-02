import { errorResponse, readJson } from "@/lib/api";
import { PlanBody } from "@/lib/api-schemas";
import { modelPlanGenerator, planStart } from "@/lib/ai/plan";
import { runPlanPipeline } from "@/lib/ai/pipeline";
import { readModelOverride } from "@/lib/ai/override";
import { getEnv } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { localClock } from "@/lib/timezone";
import { getDayById, getSettings, incrementAiUsage, savePlan, setDayMode, syncDayTasks } from "@/db/queries";
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
    const tasks = await syncDayTasks(user.id, day.id, body.tasks);
    const planFrom = planStart(day.date === clock.date, clock.time, settings);
    const result = await runPlanPipeline({ tasks, settings, mode: body.mode, planFrom }, modelPlanGenerator(await readModelOverride()));

    const { version } = await savePlan(user.id, day.id, "initial", null, result.plan, result.source, result.model);
    return Response.json({ plan: result.plan, tasks, mode: body.mode, source: result.source, model: result.model, version, plannedAt: clock.time });
  } catch (e) {
    return errorResponse(e);
  }
}
