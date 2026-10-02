import { ServerTranscriber } from "./server-client";
import type { Transcriber } from "./types";
import { WebSpeechTranscriber } from "./web-speech";

/** Web Speech where the browser has it (live text), the recorder and server otherwise. Null when neither can work. */
export function createTranscriber(): Transcriber | null {
  if (typeof window === "undefined") return null;
  if (WebSpeechTranscriber.supported()) return new WebSpeechTranscriber();
  if (ServerTranscriber.supported()) return new ServerTranscriber();
  return null;
}
