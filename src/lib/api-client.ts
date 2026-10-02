/** Browser-side calls to the account routes. Each rejects on a non-2xx so callers can roll an optimistic update back. */
import type { Preset } from "./guess";
import type { HistoryItem } from "../db/queries/history";
import type { DayView, ReplanView } from "./day-response";
import type { DayEditBody, PlanForDay } from "./api-schemas";
import type { DraftPayload } from "./draft";
import type { Plan, Question, Settings, Task, UnderstandResult } from "./schemas";

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

export type UnderstandResponse = {
  dayId: string;
  date: string;
  mode: "workday" | "dayoff";
  planFor: UnderstandResult["planFor"];
  /** True when the day already had tasks and the new ones were added to it. */
  merged: boolean;
  tasks: Task[];
  questions: Question[];
  groupings: UnderstandResult["groupings"];
  model: string;
};
export const postUnderstand = (text: string, forDay?: PlanForDay) => call<UnderstandResponse>("/api/understand", { method: "POST", body: JSON.stringify({ text, forDay }) });
export const patchTask = (id: string, patch: Partial<Pick<Task, "location" | "durationMin" | "durationSource" | "fixedStart" | "due" | "title" | "kind">> & { status?: "open" | "done" }) =>
  call<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

export type PlanResponse = { plan: Plan; tasks: Task[]; done: string[]; mode: "workday" | "dayoff"; source: "llm" | "fallback"; model: string | null; version: number; plannedAt: string };
/** Saves the tasks as left on Understand and plans the day. New tasks (local ids) are sent without an id. */
export const postPlan = (dayId: string, mode: PlanResponse["mode"], tasks: Task[]) =>
  call<PlanResponse>("/api/plan", {
    method: "POST",
    body: JSON.stringify({ dayId, mode, tasks: tasks.map(({ id, ...t }) => (/^[0-9a-f-]{36}$/.test(id) ? { id, ...t } : t)) }),
  });

export type TodayResponse = {
  date: string;
  day: { day: { id: string; mode: "workday" | "dayoff" }; tasks: DayView["tasks"]; plan: { version: number; snapshot: Plan; createdAt: string } | null } | null;
  carried: Task[];
};
/** Today's saved day (in the account's timezone) with its latest plan, and tasks moved to today from an earlier day. */
export const getToday = () => call<TodayResponse>("/api/day");
/** The saved day for one date (YYYY-MM-DD), same shape as today's. */
export const getDayOn = (date: string) => call<TodayResponse>(`/api/day?date=${date}`);

/** One change to the saved day. The server re-plans the unfinished tasks and answers with the new day. */
export const postDayEdit = (dayId: string, op: DayEditBody["op"]) =>
  call<DayView>("/api/day/edit", { method: "POST", body: JSON.stringify({ dayId, op }) });
/** Puts the tasks back as given and plan version `version` back as the newest. */
export const postDayUndo = (dayId: string, version: number, tasks: DayView["tasks"]) =>
  call<DayView>("/api/day/undo", {
    method: "POST",
    body: JSON.stringify({ dayId, version, tasks: tasks.map(({ id, title, location, kind, durationMin, durationSource, fixedStart, due, status, movedTo }) => ({ id, title, location, kind, durationMin, durationSource, fixedStart, due, status, movedTo })) }),
  });

/** Tell Untangle what changed in plain words. The server reads it, rebuilds the rest of today and answers with the new day and what changed. */
export const postReplan = (dayId: string, instruction: string) =>
  call<ReplanView>("/api/replan", { method: "POST", body: JSON.stringify({ dayId, instruction }) });

/** The unfinished list, autosaved as the user goes. */
export const getDraft = async () => (await call<{ draft: DraftPayload | null }>("/api/draft")).draft;
export const putDraft = (d: DraftPayload) => call<void>("/api/draft", { method: "PUT", body: JSON.stringify(d) });
export const deleteDraft = () => call<void>("/api/draft", { method: "DELETE" });
/** For when the page is going away: `keepalive` lets the request finish after the tab closes. */
export const putDraftOnExit = (d: DraftPayload) => { void fetch("/api/draft", { method: "PUT", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).catch(() => {}); };

export type { HistoryItem };
export type HistoryDay = { date: string; mode: "workday" | "dayoff"; tasks: DayView["tasks"]; plan: Plan; plannedAt: string };
/** Past planned days (newest first) and one of them, read-only. */
export const getHistory = async () => (await call<{ days: HistoryItem[] }>("/api/history")).days;
export const getHistoryDay = (dayId: string) => call<HistoryDay>(`/api/history/${dayId}`);
