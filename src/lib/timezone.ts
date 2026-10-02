/** True when `tz` is an IANA zone this runtime knows (for example "Europe/London"). */
export const isTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export type LocalClock = { date: string; time: string; weekday: number };

/** The date, 24-hour time and weekday (0 = Sunday) in `timeZone` at `at`. */
export function localClock(timeZone: string, at: Date = new Date()): LocalClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, time: `${parts.hour}:${parts.minute}`, weekday: new Date(`${date}T00:00:00Z`).getUTCDay() };
}

/** `date` (YYYY-MM-DD) plus `days` calendar days. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
