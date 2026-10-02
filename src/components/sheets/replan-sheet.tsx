"use client";

import { useEffect, useId, useRef, useState } from "react";
import { VOICE_PROBLEM } from "@/lib/stt/copy";
import { useVoice } from "@/lib/use-voice";
import { DELAY_OPTIONS, REPLAN_CHIPS } from "@/fixtures/replan";
import type { Task } from "@/lib/schemas";
import { toHHMM } from "@/lib/time";
import { Button } from "../button";
import { Chip } from "../chip";
import { Icon } from "../icon";
import { Sheet, SheetOption } from "../sheet";

/**
 * "What changed?" The mic fills the box with what was said; the user edits, then sends.
 * No auto-submit. Chips fill the box with a sentence so they can be combined.
 */
const join = (a: string, b: string) => (a.trim() && b ? `${a.trim()} ${b}` : a.trim() || b);

export function ReplanSheet({ nowMin, openTasks, startWithMic, onSubmit, onClose }: {
  nowMin: number; openTasks: Task[]; startWithMic?: boolean; onSubmit: (text: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [picker, setPicker] = useState<null | "task" | "delay">(null);
  const [pending, setPending] = useState<(typeof REPLAN_CHIPS)[number] | null>(null);
  const id = useId();
  const [base, setBase] = useState("");
  const voice = useVoice({ maxSeconds: 120, onLimit: (final) => setText(join(base, final).slice(0, 4000)) });
  const { phase, start, finish } = voice;
  const listening = phase === "listening" || phase === "starting";

  // Words show in the box as they are heard. Never submitted for the user.
  const shown = phase === "listening" ? join(base, voice.text).slice(0, 4000) : text;
  const talk = async () => {
    if (listening) {
      const final = await finish();
      if (final) setText(join(base, final).slice(0, 4000));
      return;
    }
    setBase(text);
    await start();
  };
  useEffect(() => { if (startWithMic) void start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const append = (s: string) => setText((t) => (t.trim() ? `${t.trim()} ${s}` : s));
  const tap = (c: (typeof REPLAN_CHIPS)[number]) => {
    if (c.needs) { setPending(c); setPicker(c.needs); } else append(c.sentence(""));
  };
  const pick = (value: string) => { if (pending) append(pending.sentence(value)); setPicker(null); setPending(null); };

  if (picker) {
    return (
      <Sheet title={picker === "task" ? "Which one?" : "How late?"} voice={picker === "task" ? (pending?.voice ?? "Pick one.") : "Tell me how far behind you are."} onClose={() => { setPicker(null); setPending(null); }}>
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
        <textarea id={`${id}-t`} value={shown} onChange={(e) => setText(e.target.value.slice(0, 4000))} rows={3} placeholder="I didn't finish SQL and I have a meeting at 2" className="min-h-[84px] flex-1 resize-none border-0 bg-transparent p-0 text-lg leading-[27px] outline-none placeholder:text-ink-muted" />
        <button type="button" aria-label={listening ? "Listening" : "Talk"} aria-pressed={listening} onClick={() => void talk()} className="grid size-14 flex-none place-items-center rounded-full border-0 bg-ink text-ink-inverse">
          <Icon name="mic" size={26} />
        </button>
      </div>
      <p role={voice.error ? "alert" : "status"} className="voice-xs m-0 mt-2 text-ink-muted">
        {voice.error ? VOICE_PROBLEM[voice.error] : phase === "processing" ? "Turning your voice into text." : listening ? "Listening. Tap the mic when you're done." : ""}
      </p>
      <p className="mb-2 mt-4 text-[13px] font-medium leading-[18px] text-ink-muted">Or tap one</p>
      <div className="flex flex-wrap gap-2">{REPLAN_CHIPS.map((c) => <Chip key={c.id} onClick={() => tap(c)}>{c.label}</Chip>)}</div>
      <div className="mt-5"><Button icon="refresh" disabled={!shown.trim()} onClick={() => onSubmit(shown.trim())}>Re-plan my day</Button></div>
      <p className="voice-xs m-0 mt-2.5 text-center text-ink-muted">Finished tasks stay put.</p>
    </Sheet>
  );
}
