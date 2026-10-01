"use client";

import { useId, useState } from "react";
import { BUILT_IN_PRESETS, KIND_LABEL, PRESET_KINDS, type Preset } from "@/lib/guess";
import type { Task } from "@/lib/schemas";
import { fmtDuration } from "@/lib/time";
import { WHERE, WHERE_ORDER, type Where } from "@/lib/where";
import { Button } from "../button";
import { Chip } from "../chip";
import { Icon } from "../icon";
import { Sheet } from "../sheet";
import { WhereTag } from "../where-tag";

const TIMES = [10, 15, 20, 30, 45, 60, 90, 120];

export function PresetsSheet({ presets, onAdd, onRemove, onClose }: { presets: Preset[]; onAdd: (p: Omit<Preset, "id">) => void; onRemove: (id: string) => void; onClose: () => void }) {
  const [phrase, setPhrase] = useState("");
  const [where, setWhere] = useState<Where>("anywhere");
  const [kind, setKind] = useState<Task["kind"]>("admin");
  const [time, setTime] = useState<number | "ask">(30);
  const id = useId();
  const label = "mb-1.5 mt-3.5 block text-[13px] font-medium leading-[18px] text-ink-muted";
  const add = () => {
    const p = phrase.trim();
    if (!p) return;
    onAdd({ phrase: p, location: where, kind, durationMin: time === "ask" ? null : time });
    setPhrase("");
  };
  const row = (p: Preset, mine: boolean) => (
    <li key={p.id} className="flex min-h-11 items-center gap-2.5 border-b border-line py-1.5 last:border-0">
      <span className="flex-1 font-medium">{p.phrase}</span>
      <WhereTag where={p.location} />
      <span className="text-[13px] font-medium text-ink-muted">{KIND_LABEL[p.kind]}, {p.durationMin === null ? "ask me" : fmtDuration(p.durationMin)}</span>
      {mine && (
        <button type="button" aria-label={`Delete ${p.phrase}`} onClick={() => onRemove(p.id)} className="grid size-11 place-items-center border-0 bg-transparent text-ink-muted"><Icon name="trash" size={18} /></button>
      )}
    </li>
  );
  return (
    <Sheet title="Presets" voice={'A preset like "Gym = Outside, Exercise, 90 min" makes every "Gym" task right with no questions.'} onClose={onClose} tall>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} aria-label="Make your own">
        <h3 className="m-0 text-lg font-bold leading-6">Make your own</h3>
        <label htmlFor={`${id}-p`} className={label}>Word or phrase</label>
        <input id={`${id}-p`} value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="Gym" maxLength={40} className="min-h-11 w-full rounded-md border border-line bg-surface-soft px-3.5 text-base" />
        <p id={`${id}-w`} className={label}>Where</p>
        <div role="radiogroup" aria-labelledby={`${id}-w`} className="flex flex-wrap gap-2">
          {WHERE_ORDER.map((w) => <Chip key={w} small role="radio" aria-checked={where === w} selected={where === w} onClick={() => setWhere(w)}>{WHERE[w].label}</Chip>)}
        </div>
        <p id={`${id}-k`} className={label}>Type</p>
        <div role="radiogroup" aria-labelledby={`${id}-k`} className="flex flex-wrap gap-2">
          {PRESET_KINDS.map((k) => <Chip key={k} small role="radio" aria-checked={kind === k} selected={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</Chip>)}
        </div>
        <label htmlFor={`${id}-t`} className={label}>Time</label>
        <select id={`${id}-t`} value={time} onChange={(e) => setTime(e.target.value === "ask" ? "ask" : Number(e.target.value))} className="min-h-11 w-full rounded-md border border-line bg-surface-soft px-3 text-base">
          {TIMES.map((m) => <option key={m} value={m}>{fmtDuration(m)}</option>)}
          <option value="ask">Time: ask me each time</option>
        </select>
        <div className="mt-4"><Button type="submit" disabled={!phrase.trim()}>Add preset</Button></div>
      </form>
      {presets.length > 0 && (<><h3 className="m-0 mt-6 text-lg font-bold leading-6">Yours</h3><ul className="m-0 list-none p-0">{presets.map((p) => row(p, true))}</ul></>)}
      <h3 className="m-0 mt-6 text-lg font-bold leading-6">Built in</h3>
      <ul className="m-0 list-none p-0">{BUILT_IN_PRESETS.map((p) => row(p, false))}</ul>
    </Sheet>
  );
}
