/** Server-side speech to text. One function, so another provider can replace Whisper later. The audio is held in memory only. */
import { getEnv } from "../env";
import { audioFileName } from "./text";

export class TranscribeFailedError extends Error {
  constructor() {
    super("transcription failed");
    this.name = "TranscribeFailedError";
  }
}

export async function transcribe(audio: Blob): Promise<string> {
  const env = getEnv();
  if (env.STT_PROVIDER !== "openai" || !env.OPENAI_API_KEY) throw new TranscribeFailedError();
  const form = new FormData();
  form.append("file", audio, audioFileName(audio.type));
  form.append("model", env.STT_MODEL);
  form.append("response_format", "json");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!res?.ok) throw new TranscribeFailedError();
  const body = (await res.json().catch(() => null)) as { text?: unknown } | null;
  if (typeof body?.text !== "string") throw new TranscribeFailedError();
  return body.text.trim();
}
