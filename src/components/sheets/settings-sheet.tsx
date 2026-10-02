"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { browserTimezone } from "@/lib/clock";
import type { Settings } from "@/lib/schemas";
import { themePreference, setThemePreference, type ThemePref } from "@/lib/theme";
import { AccountSection } from "../account-section";
import { Button } from "../button";
import { SegmentedControl } from "../segmented-control";
import { Sheet } from "../sheet";

const DAYS = [["Mo", 1], ["Tu", 2], ["We", 3], ["Th", 4], ["Fr", 5], ["Sa", 6], ["Su", 0]] as const;
const auto = browserTimezone();
/** Automatic (the browser's zone) first, then every IANA zone, plus the current value if the list lacks it. */
const zones = (current: string): string[] => {
  let all: string[] = [];
  try { all = Intl.supportedValuesOf("timeZone"); } catch { /* older browsers: keep the short list */ }
  return [...new Set([auto, current, ...all])];
};
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function SettingsSheet({ loadFailed, onRetry, settings, presetCount, onSave, onPresets, onHistory, onPassword, onClose }: { loadFailed: boolean; onRetry: () => void; settings: Settings; presetCount: number; onSave: (s: Settings) => void; onPresets: () => void; onHistory: () => void; onPassword: (hasPassword: boolean) => void; onClose: () => void }) {
  const [s, setS] = useState(settings);
  const [pref, setPref] = useState<ThemePref>(() => themePreference());
  const id = useId();
  const field = "min-h-11 w-full min-w-0 max-w-full appearance-none rounded-md border border-line bg-surface-soft px-3.5 text-base";
  const label = "mb-1.5 block text-[13px] font-medium leading-[18px] text-ink-muted";
  const time = (key: "workStart" | "workEnd" | "wake" | "sleep", text: string) => (
    <div className="min-w-0 flex-1">
      <label htmlFor={`${id}-${key}`} className={label}>{text}</label>
      <input id={`${id}-${key}`} type="time" value={s[key]} onChange={(e) => e.target.value && setS({ ...s, [key]: e.target.value })} className={field} />
    </div>
  );
  const toggleDay = (d: number) => setS({ ...s, workDays: s.workDays.includes(d) ? s.workDays.filter((x) => x !== d) : [...s.workDays, d].sort() });
  return (
    <Sheet title="Settings" onClose={onClose} tall>
      <AccountSection onPassword={onPassword} />
      {loadFailed ? (
        <div className="mt-2">
          <p role="alert" className="voice m-0 text-ask-ink">I couldn&apos;t load your settings. Check your connection, then try again.</p>
          <div className="mt-4"><Button type="button" onClick={onRetry}>Try again</Button></div>
        </div>
      ) : (
      <form onSubmit={(e) => { e.preventDefault(); onSave(s); }}>
        <div className="mb-4 flex gap-3">{time("workStart", "Work starts")}{time("workEnd", "Work ends")}</div>
        <p id={`${id}-days`} className={label}>Working days</p>
        <div role="group" aria-labelledby={`${id}-days`} className="mb-4 flex gap-1.5">
          {DAYS.map(([name, d]) => {
            const on = s.workDays.includes(d);
            return (
              <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[d]} onClick={() => toggleDay(d)} className={cn("min-h-11 min-w-0 flex-1 rounded-sm border text-sm font-semibold", on ? "border-ink bg-ink text-ink-inverse" : "border-line bg-surface text-ink")}>{name}</button>
            );
          })}
        </div>
        <div className="mb-4 flex gap-3">{time("wake", "Awake from")}{time("sleep", "Awake until")}</div>
        <label htmlFor={`${id}-tz`} className={label}>Timezone</label>
        <select id={`${id}-tz`} value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} className={`${field} mb-4`}>
          {zones(s.timezone).map((z) => <option key={z} value={z}>{z === auto ? `Automatic, ${z}` : z}</option>)}
        </select>
        <button type="button" onClick={onPresets} className="mb-4 flex min-h-[52px] w-full items-center justify-between rounded-md bg-surface-soft px-4 text-left font-semibold">
          Presets <span className="font-medium text-ink-muted">{presetCount === 0 ? "None yet" : presetCount === 1 ? "1 yours" : `${presetCount} yours`}</span>
        </button>
        <button type="button" onClick={onHistory} className="mb-4 flex min-h-[52px] w-full items-center justify-between rounded-md bg-surface-soft px-4 text-left font-semibold">
          History <span className="font-medium text-ink-muted">All days</span>
        </button>
        <p className={label}>Appearance</p>
        <SegmentedControl<ThemePref> label="Appearance" value={pref} onChange={(v) => { setPref(v); setThemePreference(v); }} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} />
        <p className="voice-sm m-0 mt-4 text-ink-muted">Your voice is turned into text and then discarded.</p>
        <div className="mt-5"><Button type="submit">Save</Button></div>
      </form>
      )}
    </Sheet>
  );
}
