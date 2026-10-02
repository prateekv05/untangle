import { errorResponse, readJson } from "@/lib/api";
import { DayUndoBody } from "@/lib/api-schemas";
import { activeTasks, type DayRow } from "@/lib/day-edit";
import type { DayView } from "@/lib/day-response";
import { requireUser } from "@/lib/session";
import { getDayState, getPlanVersion, getSettings, restoreDayTasks, savePlan } from "@/db/queries";
import { InputError, NotFoundError } from "@/db/queries/helpers";
import { localClock } from "@/lib/timezone";
import { validatePlan } from "@/lib/validate-plan";

/**
 * POST /api/day/undo { dayId, version, tasks }: the tasks go back as listed and plan version `version` is saved again as the newest,
 * so the history stays append-only and the restored plan is identical to the old one. No AI call.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = DayUndoBody.parse(await readJson(request));
    const state = await getDayState(user.id, body.dayId);
    if (!state) throw new NotFoundError("Day");
    const target = await getPlanVersion(user.id, body.dayId, body.version);
    if (!target) throw new NotFoundError("Plan");
    const own = new Set(state.rows.map((r) => r.id));
    if (body.tasks.some((t) => !own.has(t.id))) throw new InputError("Unknown task");

    // The old plan must still be a valid plan for the old tasks before anything is written.
    const restored: DayRow[] = body.tasks;
    const settings = await getSettings(user.id);
    const errors = validatePlan(target.snapshot, activeTasks(restored), settings, { mode: state.day.mode, keptTaskIds: restored.filter((t) => t.status === "done").map((t) => t.id) });
    if (errors.length) throw new InputError("That plan can no longer be restored");

    await restoreDayTasks(user.id, body.dayId, body.tasks);
    const source = target.source === "llm" ? "llm" : "fallback";
    const { version } = await savePlan(user.id, body.dayId, "edit", "undo", target.snapshot, source, target.model);
    const view: DayView = {
      dayId: body.dayId, mode: state.day.mode, plan: target.snapshot, version, source, model: target.model, plannedAt: localClock(settings.timezone).time,
      tasks: body.tasks,
    };
    return Response.json(view);
  } catch (e) {
    return errorResponse(e);
  }
}
