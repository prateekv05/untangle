"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DELAY_OPTIONS, REPLAN_CHIPS } from "@/fixtures/replan";
import type { Task } from "@/lib/schemas";
import { toHHMM } from "@/lib/time";
import { Button } from "../button";
import { Chip } from "../chip";
import { Icon } from "../icon";
import { Sheet, SheetOption } from "../sheet";

const DICTATION = "I didn't finish SQL and I have a meeting at 2.";

/**
 * "What changed?" The mic fills the box (mock dictation in Phase 1); the user edits, then sends.
 * No auto-submit. Chips fill the box with a sentence so they can be combined.
 */
export function ReplanSheet({ nowMin, openTasks, startWithMic, onSubmit, onClose }: {
  nowMin: number; openTasks: Task[]; startWithMic?: boolean; onSubmit: (text: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [picker, setPicker] = useState<null | "task" | "delay">(null);
  const [pending, setPending] = useState<(typeof REPLAN_CHIPS)[number] | null>(null);
  const [listening, setListening] = useState(!!startWithMic);
  const id = useId();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = () => {
    if (timer.current) clearInterval(timer.current);
    let i = 0;
    timer.current = setInterval(() => {
      i += 3;
      setText(DICTATION.slice(0, i));
      if (i >= DICTATION.length) { if (timer.current) clearInterval(timer.current); setListening(false); }
    }, 60);
  };
  const dictate = () => { setListening(true); run(); };
  useEffect(() => { if (startWithMic) run(); return () => { if (timer.current) clearInterval(timer.current); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const append = (s: string) => setText((t) => (t.trim() ? `${t.trim()} ${s}` : s));
  const tap = (c: (typeof REPLAN_CHIPS)[number]) => {
    if (c.needs) { setPending(c); setPicker(c.needs); } else append(c.sentence(""));
  };
  const pick = (value: string) => { if (pending) append(pending.sentence(value)); setPicker(null); setPending(null); };

  if (picker) {
    return (
      <Sheet title={picker === "task" ? "Which one?" : "How late?"} voice={picker === "task" ? "Pick the one you didn't finish." : "Tell me how far behind you are."} onClose={() => { setPicker(null); setPending(null); }}>
        {picker === "task"
          ? (openTasks.length ? openTasks.map((t) => <SheetOption key={t.id} onClick={() => pick(t.title)}>{t.title}</SheetOption>) : <p className="voice m-0 text-ink-muted">Everything is finished.</p>)
          : DELAY_OPTIONS.map((d) => <SheetOption key={d} onClick={() => pick(d)}>{d}</SheetOption>)}
      </Sheet>
    );
  }
  return (
    <Sheet title="What changed?" voice={`It's ${toHHMM(nowMin)}. Tell me, and I'll rebuild what's left of your day.`} onClose={onClose} tall>
      <div className="flex min-h-[112px] items-end gap-3 rounded-md border border-line bg-surface-soft py-3.5 pl-4 pr-3.5">
        <label htmlFor={`${id}-t`} className="sr-only">What changed?</label>
        <textarea id={`${id}-t`} value={text} onChange={(e) => setText(e.target.value.slice(0, 4000))} rows={3} placeholder="I didn't finish SQL and I have a meeting at 2" className="min-h-[84px] flex-1 resize-none border-0 bg-transparent p-0 text-lg leading-[27px] outline-none placeholder:text-ink-muted" />
        <button type="button" aria-label={listening ? "Listening" : "Talk"} aria-pressed={listening} onClick={dictate} className="grid size-14 flex-none place-items-center rounded-full border-0 bg-ink text-ink-inverse">
          <Icon name="mic" size={26} />
        </button>
      </div>
      <p className="mb-2 mt-4 text-[13px] font-medium leading-[18px] text-ink-muted">Or tap one</p>
      <div className="flex flex-wrap gap-2">{REPLAN_CHIPS.map((c) => <Chip key={c.id} onClick={() => tap(c)}>{c.label}</Chip>)}</div>
      <div className="mt-5"><Button icon="refresh" disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>Re-plan my day</Button></div>
      <p className="voice-xs m-0 mt-2.5 text-center text-ink-muted">Finished tasks stay put.</p>
    </Sheet>
  );
}
