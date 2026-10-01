"use client";

import { useState } from "react";
import type { Question } from "@/lib/schemas";
import { fmtDuration } from "@/lib/time";
import { Chip } from "./chip";

const DUE_LABEL = { today: "Today", tomorrow: "Tomorrow", week: "This week", none: "No deadline" } as const;
const HEADING = ["", "One quick question", "Two quick questions", "Three quick questions"];

/** Asks only what changes the plan, one tap each. Answered questions disappear (the parent removes them). */
export function QuestionCard({ questions, onAnswer }: { questions: Question[]; onAnswer: (q: Question, value: string | number | null) => void }) {
  if (questions.length === 0) return null;
  return (
    <section aria-label="Questions" className="mb-3.5 rounded-lg bg-ask-tint p-5">
      <h2 className="m-0 text-lg font-bold leading-6 text-ask-ink">{HEADING[Math.min(3, questions.length)]}</h2>
      <p className="voice-sm mb-1 mt-0.5 text-ink-muted">I can plan without these, but I&apos;d be guessing.</p>
      {questions.map((q, i) => (
        <div key={`${q.type}-${q.taskId}`} className={i === 0 ? "mt-3.5" : "mt-[18px]"}>
          <p className="m-0 mb-2 font-semibold">{q.prompt}</p>
          {q.type === "due" && (
            <div className="flex flex-wrap gap-2">
              {q.options.map((o) => <Chip key={o} onClick={() => onAnswer(q, o)}>{DUE_LABEL[o]}</Chip>)}
            </div>
          )}
          {q.type === "duration" && (
            <div className="flex flex-wrap gap-2">
              {q.optionsMin.map((m) => <Chip key={m} onClick={() => onAnswer(q, m)}>{fmtDuration(m)}</Chip>)}
              <Chip onClick={() => onAnswer(q, null)}>Not sure</Chip>
            </div>
          )}
          {q.type === "time" && <TimeAnswer onSet={(v) => onAnswer(q, v)} onSkip={() => onAnswer(q, null)} label={q.prompt} />}
        </div>
      ))}
    </section>
  );
}

function TimeAnswer({ onSet, onSkip, label }: { onSet: (v: string) => void; onSkip: () => void; label: string }) {
  const [v, setV] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="time" aria-label={label} value={v} onChange={(e) => setV(e.target.value)} className="min-h-11 rounded-md border border-line bg-surface px-3" />
      <Chip disabled={!v} onClick={() => onSet(v)}>Set time</Chip>
      <Chip onClick={onSkip}>Not sure</Chip>
    </div>
  );
}
