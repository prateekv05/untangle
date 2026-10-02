import { errorResponse, readJson } from "@/lib/api";
import { DayEditBody } from "@/lib/api-schemas";
import { modelPlanGenerator, planStart } from "@/lib/ai/plan";
import { runPlanPipeline } from "@/lib/ai/pipeline";
import { readModelOverride } from "@/lib/ai/override";
import { activeTasks, checkOp, keptBlocksFor } from "@/lib/day-edit";
import type { DayView } from "@/lib/day-response";
import { getEnv } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { localClock } from "@/lib/timezone";
import { addTaskToDay, getDayState, getSettings, incrementAiUsage, savePlan, setTaskStatus, updateTask } from "@/db/queries";
import { NotFoundError } from "@/db/queries/helpers";

/**
 * POST /api/day/edit { dayId, op }: one change (edit, delete, add, move later, bring back), then the unfinished tasks are re-planned
 * with the finished blocks kept exactly. The new plan is validated (model, one repair, fallback planner) and saved as the next version.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const env = getEnv();
    const { dayId, op } = DayEditBody.parse(await readJson(request));
    const before = await getDayState(user.id, dayId);
    if (!before) throw new NotFoundError("Day");
    checkOp(before.rows, op);
    const settings = await getSettings(user.id);
    const clock = localClock(settings.timezone);
    await incrementAiUsage(user.id, clock.date, env.DAILY_AI_CALL_LIMIT);

    switch (op.type) {
      case "edit": await updateTask(user.id, op.taskId, op.patch); break;
      case "delete": await setTaskStatus(user.id, op.taskId, "deleted"); break;
      case "add": await addTaskToDay(user.id, dayId, op.task); break;
      case "move": await setTaskStatus(user.id, op.taskId, "moved", op.to); break;
      case "bringBack": await setTaskStatus(user.id, op.taskId, "open"); break;
    }

    const after = await getDayState(user.id, dayId);
    if (!after) throw new NotFoundError("Day");
    const planFrom = planStart(after.day.date === clock.date, clock.time, settings);
    const result = await runPlanPipeline(
      { tasks: activeTasks(after.rows), settings, mode: after.day.mode, planFrom, keptBlocks: keptBlocksFor(after.plan?.snapshot ?? null, after.rows) },
      modelPlanGenerator(await readModelOverride()),
      "day-edit",
    );
    const { version } = await savePlan(user.id, dayId, "edit", op.type, result.plan, result.source, result.model);
    const view: DayView = {
      dayId, mode: after.day.mode, plan: result.plan, version, source: result.source, model: result.model, plannedAt: clock.time,
      tasks: after.rows.flatMap(({ status, ...t }) => (status === "deleted" ? [] : [{ ...t, status, movedTo: t.movedTo }])),
    };
    return Response.json(view);
  } catch (e) {
    return errorResponse(e);
  }
}
