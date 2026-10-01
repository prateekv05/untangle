"use client";

import { useId, useState } from "react";
import { BUILT_IN_PRESETS, guessTask, type Preset } from "@/lib/guess";
import type { Task } from "@/lib/schemas";
import { fmtDuration } from "@/lib/time";
import { WHERE, WHERE_ORDER, type Where } from "@/lib/where";
import { Button } from "./button";
import { Chip } from "./chip";
import { DURATION_CHOICES } from "./understand-row";

/** "+ Forgot something? Add it": text, preset chips, Where, How long. The guess updates live as the user types. */
export function AddTaskCard({ presets, onAdd, onCancel }: { presets: Preset[]; onAdd: (t: Omit<Task, "id">) => void; onCancel?: () => void }) {
  const [text, setText] = useState("");
  const [where, setWhere] = useState<Where | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const id = useId();
  const guess = guessTask(text || "Task", presets);
  const effWhere = where ?? guess.location;
  const effMin = minutes ?? guess.durationMin;
  const quick = [...presets, ...BUILT_IN_PRESETS].slice(0, 5);
  const submit = () => {
    if (!text.trim()) return;
    onAdd({ ...guess, location: effWhere, durationMin: effMin, durationSource: minutes !== null ? "user" : guess.durationSource });
    setText(""); setWhere(null); setMinutes(null);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Add a task" className="mt-2.5 rounded-lg border border-line bg-surface p-4">
      <label htmlFor={`${id}-t`} className="mb-1.5 block text-[13px] font-medium leading-[18px] text-ink-muted">What is it?</label>
      <input id={`${id}-t`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Water the plants" className="min-h-11 w-full rounded-md border border-line bg-surface-soft px-3.5 text-base" />
      <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Quick starts">
        {quick.map((p) => <Chip key={p.id} small type="button" onClick={() => setText((t) => (t ? t : `${p.phrase} `))}>{p.phrase}</Chip>)}
      </div>
      <p id={`${id}-w`} className="m-0 mb-1.5 mt-3.5 text-[13px] font-medium leading-[18px] text-ink-muted">Where</p>
      <div role="radiogroup" aria-labelledby={`${id}-w`} className="flex flex-wrap gap-2">
        {WHERE_ORDER.map((w) => (
          <Chip key={w} small role="radio" aria-checked={effWhere === w} selected={effWhere === w} onClick={() => setWhere(w)}>{WHERE[w].label}</Chip>
        ))}
      </div>
      <label htmlFor={`${id}-d`} className="mb-1.5 mt-3.5 block text-[13px] font-medium leading-[18px] text-ink-muted">How long</label>
      <select id={`${id}-d`} value={effMin} onChange={(e) => setMinutes(Number(e.target.value))} className="min-h-11 w-full rounded-md border border-line bg-surface-soft px-3 text-base">
        {[...new Set([...DURATION_CHOICES, effMin])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{minutes === null && m === effMin ? `Auto, ${fmtDuration(m)}` : fmtDuration(m)}</option>)}
      </select>
      <div className="mt-4 flex items-center gap-2">
        <Button type="submit" disabled={!text.trim()}>Add task</Button>
        {onCancel && <Button variant="quiet" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
