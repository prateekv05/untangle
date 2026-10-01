"use client";

import { useId, useState } from "react";
import type { Task } from "@/lib/schemas";
import { fmtDuration } from "@/lib/time";
import { WHERE, WHERE_ORDER, type Where } from "@/lib/where";
import { Button } from "../button";
import { Chip } from "../chip";
import { Sheet } from "../sheet";
import { DURATION_CHOICES } from "../understand-row";

export function EditSheet({ task, onSave, onDelete, onClose }: { task: Task; onSave: (patch: Partial<Task>) => void; onDelete: () => void; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [where, setWhere] = useState<Where>(task.location);
  const [minutes, setMinutes] = useState(task.durationMin);
  const [fixed, setFixed] = useState(task.fixedStart ?? "");
  const id = useId();
  const label = "mb-1.5 mt-3.5 block text-[13px] font-medium leading-[18px] text-ink-muted";
  const field = "min-h-11 w-full rounded-md border border-line bg-surface-soft px-3.5 text-base";
  const save = () => {
    const t = title.trim();
    if (!t) return;
    const durationChanged = minutes !== task.durationMin;
    onSave({
      title: t, location: where, durationMin: minutes, fixedStart: fixed || null,
      durationSource: durationChanged ? "user" : task.durationSource,
      kind: fixed && task.kind !== "health" ? "fixed" : task.kind,
    });
  };
  return (
    <Sheet title="Edit task" voice="I'll re-plan only what's still open." onClose={onClose} tall>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label htmlFor={`${id}-n`} className={label} style={{ marginTop: 0 }}>Name</label>
        <input id={`${id}-n`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} />
        <p id={`${id}-w`} className={label}>Where</p>
        <div role="radiogroup" aria-labelledby={`${id}-w`} className="flex flex-wrap gap-2">
          {WHERE_ORDER.map((w) => <Chip key={w} role="radio" aria-checked={where === w} selected={where === w} onClick={() => setWhere(w)}>{WHERE[w].label}</Chip>)}
        </div>
        <label htmlFor={`${id}-d`} className={label}>How long</label>
        <select id={`${id}-d`} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={field}>
          {[...new Set([...DURATION_CHOICES, task.durationMin])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{fmtDuration(m)}</option>)}
        </select>
        <label htmlFor={`${id}-f`} className={label}>Fixed time, optional</label>
        <div className="flex items-center gap-2">
          <input id={`${id}-f`} type="time" value={fixed} onChange={(e) => setFixed(e.target.value)} className={`${field} flex-1`} />
          {fixed && <Button variant="quiet" onClick={() => setFixed("")}>Clear</Button>}
        </div>
        <div className="mt-6"><Button type="submit" disabled={!title.trim()}>Save and re-plan</Button></div>
        <div className="mt-1.5 flex justify-center"><Button variant="danger" onClick={onDelete}>Delete task</Button></div>
      </form>
    </Sheet>
  );
}
