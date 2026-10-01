/**
 * The app's "now". Phase 1 fixtures have no real timeline, so the clock is clamped to the daytime
 * window and can be pinned with ?now=HH:MM (used for screenshots and tests).
 */
import { HHMM } from "./schemas";
import { toMin } from "./time";

const DAY_START = toMin("08:30");
const DAY_END = toMin("19:00");

export function nowMinutes(search?: string, date: Date = new Date()): number {
  const pinned = new URLSearchParams(search ?? "").get("now");
  if (pinned && HHMM.safeParse(pinned).success) return toMin(pinned);
  const real = date.getHours() * 60 + date.getMinutes();
  return Math.min(Math.max(real, DAY_START), DAY_END);
}

/** Round up to the next 5 minutes so a rebuilt day never starts in the past. */
export const roundUp5 = (n: number): number => Math.ceil(n / 5) * 5;
