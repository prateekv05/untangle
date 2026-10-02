/** True when `tz` is an IANA zone this runtime knows (for example "Europe/London"). */
export const isTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
