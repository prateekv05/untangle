/** Pure helpers for the listening screen: no I/O, no browser APIs. */
import { guessTask } from "../guess";
import type { Task } from "../schemas";

const LEAD = /^(?:(?:okay|ok|so|um+|uh+|well|like|right|and|also|then|plus|first|next|finally|oh)(?:[,\s]+|$))+/i;
const NEED = /^(?:(?:i|we)\s+(?:really\s+|also\s+|still\s+)?(?:need|have|want|should|must|got|gotta|ought)\s+to\s+|(?:need|have|want|got|gotta)\s+to\s+|i'?m\s+going\s+to\s+|to\s+)+/i;
const DAY = /\b(?:for\s+)?(?:tomorrow|today|tonight|this\s+(?:morning|afternoon|evening))\b[,\s]*/gi;
const SPLIT = /[\n,;.!?]+|\s+(?:and|then|plus)\s+/i;

export type HeardChip = { title: string; location: Task["location"] };

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "Heard so far" chips from a partial transcript (docs/VOICE.md fallback: a client-side split, display only).
 * The last piece is still being spoken, so it is held back until something follows it.
 */
export function heardChips(transcript: string, final = false): HeardChip[] {
  const parts = transcript.split(SPLIT);
  const complete = final ? parts : parts.slice(0, -1);
  const seen = new Set<string>();
  const chips: HeardChip[] = [];
  for (const raw of complete) {
    const cleaned = [LEAD, NEED, DAY, LEAD, NEED].reduce((t, re) => t.replace(re, "").trim(), raw.trim());
    if (cleaned.length < 3 || cleaned.split(/\s+/).length > 8) continue;
    const { title, location } = guessTask(cleaned);
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    chips.push({ title: sentence(title), location });
  }
  return chips;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Planning for tomorrow, Friday" from the words said, or null when no day was mentioned. `today` is a weekday number 0 to 6. */
export function planningChip(transcript: string, today: number): string | null {
  const t = transcript.toLowerCase();
  if (/\btomorrow\b/.test(t)) return `Planning for tomorrow, ${WEEKDAYS[(today + 1) % 7]}`;
  const named = WEEKDAYS.find((d) => new RegExp(`\\b${d.toLowerCase()}\\b`).test(t));
  if (named) return `Planning for ${named}`;
  if (/\b(today|tonight)\b/.test(t)) return `Planning for today, ${WEEKDAYS[today]}`;
  return null;
}

/** Best supported recording type: webm/opus first, mp4 for Safari, otherwise let the browser choose. */
export function pickMime(isSupported: (mime: string) => boolean): string | null {
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(isSupported) ?? null;
}

/** File name Whisper accepts for the recorded type (it sniffs the extension). */
export function audioFileName(mime: string): string {
  if (mime.includes("mp4")) return "dump.m4a";
  if (mime.includes("ogg")) return "dump.ogg";
  return "dump.webm";
}

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

/** What /api/transcribe accepts. Returns the reason it refuses, or null. `seconds` is what the client's timer says. */
export function audioProblem(file: { size: number; type: string }, seconds: number | null, maxSeconds: number): "empty" | "too_large" | "too_long" | "bad_type" | null {
  if (file.size < 1) return "empty";
  if (file.size > MAX_AUDIO_BYTES) return "too_large";
  if (!/^audio\/|^video\/(webm|mp4)$/.test(file.type)) return "bad_type";
  if (seconds !== null && seconds > maxSeconds + 5) return "too_long";
  return null;
}
