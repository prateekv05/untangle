"use client";

import { useState } from "react";
import type { Preset } from "@/lib/guess";
import type { PlanMode } from "@/lib/planner";
import type { Question, Task } from "@/lib/schemas";
import type { Where } from "@/lib/where";
import { AddTaskCard } from "../add-task-card";
import { Button } from "../button";
import { QuestionCard } from "../question-card";
import { RelationshipCard } from "../relationship-card";
import { SegmentedControl } from "../segmented-control";
import { TopBar } from "../top-bar";
import { UnderstandRow } from "../understand-row";

export function UnderstandScreen({ tasks, questions, mode, presets, onMode, onAnswer, onRemove, onWhere, onDuration, onAdd, onBuild, onBack, onSettings }: {
  tasks: Task[]; questions: Question[]; mode: PlanMode; presets: Preset[];
  onMode: (m: PlanMode) => void; onAnswer: (q: Question, v: string | number | null) => void; onRemove: (id: string) => void;
  onWhere: (id: string, w: Where) => void; onDuration: (id: string, min: number | null) => void;
  onAdd: (t: Omit<Task, "id">) => void; onBuild: () => void; onBack: () => void; onSettings: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="min-h-dvh">
      <TopBar onSettings={onSettings} />
      <main className="px-5 pb-10 pt-[22px]">
        <h1 className="m-0 text-[32px] font-bold leading-9 tracking-[-0.02em]">Here&apos;s what I understood</h1>
        <p className="mb-[18px] mt-2 text-ink-muted">Tap anything that&apos;s off to fix it.</p>
        <QuestionCard questions={questions} onAnswer={onAnswer} />
        <RelationshipCard tasks={tasks} />
        <div className="mb-3.5">
          <SegmentedControl label="Day type" value={mode} onChange={onMode} options={[{ value: "workday", label: "Workday" }, { value: "dayoff", label: "Day off" }]} />
        </div>
        <ul className="m-0 flex flex-col gap-2 p-0">
          {tasks.map((t) => (
            <UnderstandRow key={t.id} task={t} onRemove={() => onRemove(t.id)} onWhere={(w) => onWhere(t.id, w)} onDuration={(m) => onDuration(t.id, m)} />
          ))}
        </ul>
        {adding ? (
          <AddTaskCard presets={presets} onAdd={(t) => { onAdd(t); setAdding(false); }} onCancel={() => setAdding(false)} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="mt-2.5 min-h-[52px] w-full rounded-md border border-dashed border-line bg-transparent text-[15px] font-medium leading-5 text-ink-muted">
            + Forgot something? Add it
          </button>
        )}
        <div className="mt-6"><Button disabled={tasks.length === 0} onClick={onBuild}>Build my day</Button></div>
        <div className="mt-1.5 flex justify-center"><Button variant="quiet" onClick={onBack}>Edit my list</Button></div>
      </main>
    </div>
  );
}
