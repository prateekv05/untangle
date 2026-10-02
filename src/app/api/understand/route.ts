import { errorResponse, readJson } from "@/lib/api";
import { understandBody } from "@/lib/api-schemas";
import { readModelOverride } from "@/lib/ai/override";
import { UnderstandFailedError, understand } from "@/lib/ai/understand";
import { getEnv } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { addDays, localClock } from "@/lib/timezone";
import { getSettings, incrementAiUsage, replaceDayWithTasks } from "@/db/queries";
import { listPresets } from "@/db/queries/presets";

/**
 * POST /api/understand { text }: read the dump, create the day and its tasks, return them with the questions and groupings.
 * The model's "t1".."tN" ids are swapped for the saved task ids before anything leaves the server.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const env = getEnv();
    const { text } = understandBody(env.MAX_DUMP_CHARS).parse(await readJson(request));
    const settings = await getSettings(user.id);
    const clock = localClock(settings.timezone);
    await incrementAiUsage(user.id, clock.date, env.DAILY_AI_CALL_LIMIT);
    const presets = (await listPresets(user.id)).map((p) => ({ verb: p.verb, location: p.location, kind: p.kind, defaultDurationMin: p.defaultDurationMin }));

    let out;
    try {
      out = await understand({ text, today: clock.date, now: clock.time, timezone: settings.timezone, settings, presets }, await readModelOverride());
    } catch (e) {
      if (e instanceof UnderstandFailedError) return Response.json({ error: "understand_failed" }, { status: 502 });
      throw e;
    }

    const { result, meta } = out;
    const date = result.planFor === "tomorrow" ? addDays(clock.date, 1) : clock.date;
    const weekday = result.planFor === "tomorrow" ? (clock.weekday + 1) % 7 : clock.weekday;
    const mode = settings.workDays.includes(weekday) ? "workday" : "dayoff";
    const saved = await replaceDayWithTasks(user.id, date, mode, text, result.tasks.map(({ title, location, kind, durationMin, durationSource, fixedStart, due }) => ({ title, location, kind, durationMin, durationSource, fixedStart, due })));

    const ids = new Map(result.tasks.map((t, i) => [t.id, saved.tasks[i].id]));
    const remap = <T extends { taskId: string }>(q: T): T => ({ ...q, taskId: ids.get(q.taskId) ?? q.taskId });
    return Response.json({
      dayId: saved.day.id,
      date,
      mode,
      planFor: result.planFor,
      tasks: saved.tasks,
      questions: result.questions.map(remap),
      groupings: result.groupings.map((g) => ({ ...g, taskIds: g.taskIds.map((id) => ids.get(id) ?? id) })),
      model: meta.model,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
