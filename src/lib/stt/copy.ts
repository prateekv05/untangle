import type { VoiceErrorCode } from "./types";

/** What Untangle says when voice does not work. Always ends with a way forward: typing. */
export const VOICE_PROBLEM: Record<VoiceErrorCode, string> = {
  denied: "Microphone is blocked. You can still type.",
  empty: "I didn't catch anything. Try again, or type it.",
  unsupported: "This browser can't record. You can still type.",
  failed: "I couldn't turn that into text. Try again, or type it.",
  daily_limit: "That's today's limit for voice. You can still type.",
};
