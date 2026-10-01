/** Minutes since midnight <-> "HH:MM". All scheduling math uses minutes. */
export const toMin = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const toHHMM = (n: number): string =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export const fmtDuration = (n: number): string =>
  n >= 60 ? (n % 60 ? `${Math.floor(n / 60)} h ${n % 60} min` : `${n / 60} h`) : `${n} min`;
