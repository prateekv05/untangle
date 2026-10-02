import { errorResponse } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { TranscribeFailedError, transcribe } from "@/lib/stt/server";
import { MAX_AUDIO_BYTES, audioProblem } from "@/lib/stt/text";
import { localClock } from "@/lib/timezone";
import { getSettings, incrementAiUsage } from "@/db/queries";

/**
 * POST /api/transcribe (multipart: audio, seconds): audio in, { text } out.
 * Capped at MAX_AUDIO_SECONDS and 5 MB, counted against the daily AI limit. The audio is never written anywhere
 * and the transcript is never logged; the caller keeps the text.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const env = getEnv();
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_AUDIO_BYTES + 64 * 1024) return Response.json({ error: "too_large" }, { status: 413 });

    const form = await request.formData().catch(() => null);
    const audio = form?.get("audio");
    if (!(audio instanceof Blob)) return Response.json({ error: "invalid_input" }, { status: 400 });
    const rawSeconds = Number(form?.get("seconds"));
    const problem = audioProblem(audio, Number.isFinite(rawSeconds) && form?.has("seconds") ? rawSeconds : null, env.MAX_AUDIO_SECONDS);
    if (problem) return Response.json({ error: problem }, { status: problem === "too_large" ? 413 : 400 });

    const settings = await getSettings(user.id);
    await incrementAiUsage(user.id, localClock(settings.timezone).date, env.DAILY_AI_CALL_LIMIT);
    try {
      return Response.json({ text: await transcribe(audio) });
    } catch (e) {
      if (e instanceof TranscribeFailedError) return Response.json({ error: "transcribe_failed" }, { status: 502 });
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}
