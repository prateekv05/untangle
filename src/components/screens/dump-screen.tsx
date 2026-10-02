"use client";

import { useId, useRef, useState } from "react";
import type { DraftPayload } from "@/lib/draft";
import { BUILT_IN_PRESETS, countThings, type Preset } from "@/lib/guess";
import type { PlanForDay } from "@/lib/api-schemas";
import { VOICE_PROBLEM } from "@/lib/stt/copy";
import { useVoice } from "@/lib/use-voice";
import { Button } from "../button";
import { Chip } from "../chip";
import { Icon } from "../icon";
import { SegmentedControl } from "../segmented-control";
import { Sheet } from "../sheet";
import { TopBar } from "../top-bar";
import { Waveform } from "../waveform";

const QUICK = ["Call", "Buy", "Go to", "Order", "Email"].map((n) => BUILT_IN_PRESETS.find((p) => p.phrase === n)!);
const PLACEHOLDER = "Finish the Q3 report, reply to Priya, prep for the 2pm client call, gym, groceries, call Mom, book the dentist…";

export const VOICE_LIMIT_SECONDS = 120;
const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/** What was said joins whatever was already typed, within the 4,000 character cap. */
const joinHeard = (typed: string, heard: string) => `${typed.trim() ? `${typed.trim()}\n` : ""}${heard}`.slice(0, 4000);

export const countLabel = (n: number): string => (n === 0 ? "Nothing yet" : n === 1 ? "1 thing so far" : `${n} things so far`);

const draftSummary = (d: DraftPayload): string => {
  const n = d.screen === "understand" ? d.tasks.length : countThings(d.text);
  return `I kept ${n === 1 ? "1 thing" : `${n} things`} for you, right where you stopped.`;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayOptions = (today: Date): { value: PlanForDay; label: string }[] => [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "dayafter", label: WEEKDAYS[(today.getDay() + 2) % 7] },
];

export function DumpScreen({ text, onText, onSubmit, onSettings, onYours, presets, carried = [], onCarry, draft = null, onContinueDraft, onDiscardDraft, notice, onRetry, examples, onExample, name, offline, forDay = "today", onForDay, today = new Date(), onBackToPlan }: {
  text: string; onText: (t: string) => void; onSubmit: () => void; onSettings: () => void; onYours: () => void;
  presets: Preset[]; carried?: string[]; onCarry?: (title: string) => void; draft?: DraftPayload | null; onContinueDraft?: () => void; onDiscardDraft?: () => void; notice?: string | null; onRetry?: () => void;
  examples?: { label: string; text: string }[]; onExample?: (text: string) => void; name?: string | null; offline?: boolean;
  forDay?: PlanForDay; onForDay?: (d: PlanForDay) => void; today?: Date; onBackToPlan?: () => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const noticeId = useId();

  // Dictation happens right here: the words land in the box (never sent for the user), where they can be edited before "Untangle my day".
  const [base, setBase] = useState("");
  const [limited, setLimited] = useState(false);
  const voice = useVoice({ maxSeconds: VOICE_LIMIT_SECONDS, onLimit: (final) => { onText(joinHeard(base, final)); setLimited(true); } });
  const { phase, begin, start, finish } = voice;
  const listening = phase === "listening";
  const recording = listening || phase === "starting" || phase === "processing";
  const shown = listening ? joinHeard(base, voice.text) : text;
  const talk = async () => {
    if (listening) {
      const final = await finish();
      if (final) onText(joinHeard(base, final));
      return;
    }
    setLimited(false);
    setBase(text);
    await begin();
  };
  const n = countThings(shown);
  const insert = (phrase: string) => {
    onText(text.trim() ? `${text.replace(/\s+$/, "")}\n${phrase} ` : `${phrase} `);
    requestAnimationFrame(() => { const a = area.current; if (a) { a.focus(); a.setSelectionRange(a.value.length, a.value.length); } });
  };
  const chips = [...presets.map((p) => p.phrase), ...QUICK.map((p) => p.phrase)].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar onSettings={onSettings} />
      <main className="flex flex-1 flex-col px-5 pt-[22px]">
        <h1 id="dump-heading" className="m-0 text-4xl font-bold leading-[38px] tracking-[-0.02em]">{name ? `What's on your mind, ${name}?` : "What's on your mind?"}</h1>
        <p className="mb-3.5 mt-2.5 text-ink-muted">Say it or type it, in any order. I&apos;ll untangle it.</p>
        {onForDay && (
          <div className="mb-3.5">
            <SegmentedControl label="Plan for" value={forDay} options={dayOptions(today)} onChange={onForDay} />
          </div>
        )}
        {onBackToPlan && (
          <div className="-mt-1 mb-2.5">
            <Button variant="quiet" onClick={onBackToPlan}>Back to my plan</Button>
          </div>
        )}
        {draft && (
          <section aria-label="Unfinished list" className="mb-3.5 rounded-md border border-line bg-surface p-4">
            <p className="m-0 font-semibold">You have an unfinished list</p>
            <p className="voice-sm mb-3 mt-1 text-ink-muted">{draftSummary(draft)}</p>
            <div className="flex flex-wrap gap-2">
              <Chip small selected onClick={onContinueDraft}>Continue</Chip>
              <Chip small onClick={onDiscardDraft}>Start fresh</Chip>
            </div>
          </section>
        )}
        {carried.length > 0 && (
          <section aria-label="Carried over" className="mb-3.5 rounded-md border border-line bg-surface p-4">
            <p className="m-0 mb-2 font-semibold">Carried over: {carried.join(", ")}.</p>
            <div className="flex flex-wrap gap-2">
              {carried.map((c) => <Chip key={c} small onClick={() => onCarry?.(c)}>Add {c}</Chip>)}
            </div>
          </section>
        )}
        <div className="flex h-[290px] flex-col rounded-lg border border-line bg-surface p-5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
          <textarea
            ref={area}
            aria-labelledby="dump-heading"
            aria-describedby={notice ? noticeId : undefined}
            value={shown}
            readOnly={recording}
            onChange={(e) => onText(e.target.value.slice(0, 4000))}
            placeholder={PLACEHOLDER}
            className="min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-0 text-xl leading-[30px] outline-none placeholder:text-ink-muted"
          />
          <div className="flex items-center justify-between gap-3">
            {recording ? (
              <div role="status" className="min-w-0 flex-1 text-center">
                <p className="m-0 text-[13px] font-semibold leading-[18px] text-ink-muted">
                  {phase === "processing" ? "Turning your voice into text." : <>Listening <span className="tabular-nums" aria-label={`${voice.seconds} seconds`}>{fmtClock(voice.seconds)}</span></>}
                </p>
                <Waveform compact levels={listening ? voice.levels : undefined} active={phase !== "processing"} />
              </div>
            ) : (
              <span aria-live="polite" className="text-[13px] font-medium leading-[18px] text-ink-muted">{countLabel(n)}</span>
            )}
            <button
              type="button"
              aria-label={listening ? "Done talking" : "Tap to talk"}
              disabled={offline || phase === "starting" || phase === "processing"}
              onClick={() => void talk()}
              className="grid size-[68px] shrink-0 place-items-center rounded-full border-0 bg-ink text-ink-inverse disabled:opacity-40"
            >
              {recording ? <span className="block size-6 rounded-md bg-ink-inverse" aria-hidden="true" /> : <Icon name="mic" size={30} />}
            </button>
          </div>
        </div>
        {(voice.error || limited) && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p role="alert" className="m-0 text-sm font-medium text-danger">{voice.error ? VOICE_PROBLEM[voice.error] : "That's the limit. I kept what I heard."}</p>
            {(voice.error === "empty" || voice.error === "failed") && <Button variant="quiet" disabled={offline} onClick={() => void talk()}>Try again</Button>}
          </div>
        )}
        {notice && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p id={noticeId} role="status" className="m-0 text-sm font-medium text-danger">{notice}</p>
            {onRetry && <Button variant="quiet" disabled={offline} onClick={onRetry}>Retry</Button>}
          </div>
        )}
        <p className="mb-2 mt-[18px] text-[13px] font-medium leading-[18px] text-ink-muted">Quick starts, optional</p>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {chips.map((c) => <Chip key={c} small onClick={() => insert(c)}>{c}</Chip>)}
          <Chip small dashed onClick={onYours}>+ Yours</Chip>
        </div>
        {examples && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">{examples.map((e) => <Chip key={e.label} small onClick={() => onExample?.(e.text)}>{e.label}</Chip>)}</div>
          </div>
        )}
        <div className="mt-auto pb-8 pt-6">
          <Button disabled={n < 1 || offline || recording} onClick={onSubmit}>Untangle my day</Button>
        </div>
      </main>
      {phase === "ask" && (
        <Sheet title="Allow the microphone?" voice="Untangle needs your microphone to hear you." onClose={voice.reset}>
          <div className="flex flex-col gap-3">
            <Button icon="mic" onClick={() => void start()}>Allow microphone</Button>
            <Button variant="secondary" onClick={voice.reset}>Type instead</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
