import { errorResponse, readJson } from "@/lib/api";
import { replanBody } from "@/lib/api-schemas";
import { InterpretFailedError, interpretReplan, isEmptyConstraints } from "@/lib/ai/replan";
import { modelPlanGenerator } from "@/lib/ai/plan";
import { runPlanPipeline } from "@/lib/ai/pipeline";
import { readModelOverride } from "@/lib/ai/override";
import { activeTasks, keptBlocksFor } from "@/lib/day-edit";
import type { ReplanView } from "@/lib/day-response";
import { getEnv } from "@/lib/env";
import { changeLines, planReplanChanges } from "@/lib/replan";
import { diffStarts } from "@/lib/planner";
import { requireUser } from "@/lib/session";
import { toMin } from "@/lib/time";
import { addDays, localClock } from "@/lib/timezone";
import { addTaskToDay, getDayState, getSettings, incrementAiUsage, savePlan, setTaskStatus } from "@/db/queries";
import { InputError, NotFoundError } from "@/db/queries/helpers";

/**
 * POST /api/replan { dayId, instruction }: read what changed, apply it, and rebuild the rest of today from now.
 * Finished blocks stay put. The new plan is validated (model, one repair, fallback planner) and saved as the next version.
 * Nothing is saved when the sentence cannot be read: the plan stays as it is.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const env = getEnv();
    const { dayId, instruction } = replanBody(env.MAX_DUMP_CHARS).parse(await readJson(request));
    const before = await getDayState(user.id, dayId);
    if (!before?.plan) throw new NotFoundError("Day");
    const settings = await getSettings(user.id);
    const clock = localClock(settings.timezone);
    if (before.day.date !== clock.date) throw new InputError("Re-plan works on today's plan");
    await incrementAiUsage(user.id, clock.date, env.DAILY_AI_CALL_LIMIT);

    const override = await readModelOverride();
    const previous = before.plan.snapshot;
    const nowMin = toMin(clock.time);
    let constraints;
    try {
      ({ constraints } = await interpretReplan({
        instruction, now: clock.time, currentPlan: previous,
        tasks: before.rows.flatMap((r) => (r.status === "open" || r.status === "done" ? [{ id: r.id, title: r.title, status: r.status, location: r.location, kind: r.kind, durationMin: r.durationMin }] : [])),
      }, override));
    } catch (e) {
      if (e instanceof InterpretFailedError) return Response.json({ error: "replan_failed" }, { status: 502 });
      throw e;
    }
    if (isEmptyConstraints(constraints)) return Response.json({ error: "replan_failed" }, { status: 502 });

    const changes = planReplanChanges(constraints, before.rows, previous, nowMin);
    for (const id of changes.reopen) await setTaskStatus(user.id, id, "open");
    for (const id of changes.markDone) await setTaskStatus(user.id, id, "done");
    for (const id of changes.drop) await setTaskStatus(user.id, id, "moved", addDays(clock.date, 1));
    const added = [];
    for (const task of changes.newEvents) added.push(await addTaskToDay(user.id, dayId, task));

    const after = await getDayState(user.id, dayId);
    if (!after) throw new NotFoundError("Day");
    const planFrom = Math.max(changes.minStart, toMin(settings.wake));
    const result = await runPlanPipeline(
      { tasks: activeTasks(after.rows), settings, mode: after.day.mode, planFrom, keptBlocks: keptBlocksFor(previous, after.rows), limits: changes.limits },
      modelPlanGenerator(override),
      "replan",
    );
    const { version } = await savePlan(user.id, dayId, "replan", instruction, result.plan, result.source, result.model);

    const was = diffStarts(previous, result.plan);
    const titles = new Map(after.rows.map((r) => [r.id, r.title]));
    const view: ReplanView = {
      dayId, mode: after.day.mode, plan: result.plan, version, source: result.source, model: result.model, plannedAt: clock.time,
      tasks: after.rows.flatMap(({ status, ...t }) => (status === "deleted" ? [] : [{ ...t, status, movedTo: t.movedTo }])),
      changes: { at: clock.time, was, lines: changeLines(previous, result.plan, titles, was, changes.limits, added.map((t) => t.id), changes.drop) },
    };
    return Response.json(view);
  } catch (e) {
    return errorResponse(e);
  }
}
