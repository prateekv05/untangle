/** Browser-side calls to the account routes. Each rejects on a non-2xx so callers can roll an optimistic update back. */
import type { Preset } from "./guess";
import type { Settings } from "./schemas";

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`request failed (${status})`);
    this.name = "ApiError";
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: init?.body ? { "Content-Type": "application/json" } : undefined });
  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load so the proxy re-checks the session
    window.location.assign("/welcome"); // session ended: back to the gate
    throw new ApiError(401);
  }
  if (!res.ok) throw new ApiError(res.status);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

type PresetRow = { id: string; verb: string; location: Preset["location"]; kind: Preset["kind"]; defaultDurationMin: number | null };
export const toUiPreset = (r: PresetRow): Preset => ({ id: r.id, phrase: r.verb, location: r.location, kind: r.kind, durationMin: r.defaultDurationMin });

export const getSettings = () => call<Settings>("/api/settings");
export const putSettings = (s: Settings) => call<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(s) });
export const getPresets = async () => (await call<PresetRow[]>("/api/presets")).map(toUiPreset);
export const postPreset = async (p: Omit<Preset, "id">) =>
  toUiPreset(await call<PresetRow>("/api/presets", { method: "POST", body: JSON.stringify({ verb: p.phrase, location: p.location, kind: p.kind, defaultDurationMin: p.durationMin }) }));
export const deletePreset = (id: string) => call<void>(`/api/presets/${id}`, { method: "DELETE" });
