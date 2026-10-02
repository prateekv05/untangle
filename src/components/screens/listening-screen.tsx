"use client";

import { useEffect, useMemo } from "react";
import { heardChips, planningChip } from "@/lib/stt/text";
import { VOICE_PROBLEM } from "@/lib/stt/copy";
import { useVoice } from "@/lib/use-voice";
import { WHERE } from "@/lib/where";
import { Button } from "../button";
import { Icon } from "../icon";
import { Sheet } from "../sheet";
import { Waveform } from "../waveform";

const WORDS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things", "Six things", "Seven things", "Eight things", "Nine things", "Ten things"];
export const LIMIT_SECONDS = 120;
const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Real dictation through the Transcriber (docs/VOICE.md). Live text where the browser has it, otherwise the waveform
 * and "Listening" until Done. The words go up as text; the audio is never kept. Close discards.
 */
export function ListeningScreen({ onClose, onDone, onLimit }: { onClose: () => void; onDone: (text: string) => void; onLimit: (text: string) => void }) {
  const voice = useVoice({ maxSeconds: LIMIT_SECONDS, onLimit });
  const { phase, text, levels, seconds, error, begin, start, finish } = voice;
  useEffect(() => { void begin(); }, [begin]);

  const chips = useMemo(() => heardChips(text), [text]);
  const planning = useMemo(() => planningChip(text, new Date().getDay()), [text]);
  const done = async () => {
    const final = await finish();
    if (final) onDone(final);
  };

  const header = (
    <header className="flex h-[58px] items-center justify-between px-3 pt-3.5">
      <button type="button" aria-label="Cancel" onClick={onClose} className="grid size-11 place-items-center rounded-sm text-ink"><Icon name="close" size={22} /></button>
      <span className="text-[15px] font-semibold leading-5">Listening</span>
      <span className="w-11 pr-2 text-right text-[15px] font-semibold leading-5 tabular-nums text-ink-muted" aria-label={`${seconds} seconds`}>{fmtClock(seconds)}</span>
    </header>
  );

  if (phase === "error" && error) {
    return (
      <div className="flex min-h-dvh flex-col">
        {header}
        <main className="flex-1 px-5 pt-6">
          <p role="alert" className="m-0 text-xl font-semibold leading-[30px]">{VOICE_PROBLEM[error]}</p>
          <div className="mt-6 flex flex-col gap-3">
            {(error === "empty" || error === "failed") && <Button icon="mic" onClick={() => void start()}>Try again</Button>}
            <Button variant={error === "empty" || error === "failed" ? "secondary" : undefined} onClick={onClose}>Type instead</Button>
          </div>
        </main>
      </div>
    );
  }

  const processing = phase === "processing" || phase === "done";
  const live = phase === "listening" || processing;
  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="flex-1 px-5 pt-2.5">
        {planning && <span className="inline-block rounded-pill bg-surface-soft px-2.5 py-1 text-[13px] font-semibold leading-[18px] text-ink-muted">{planning}</span>}
        <p aria-live="off" className="m-0 mt-5 min-h-[30px] text-[21px] font-medium leading-[30px]">
          {text || <span className="text-ink-muted">{live ? "Listening" : "Getting the microphone ready"}</span>}
        </p>
        <Waveform levels={live && !processing ? levels : undefined} active={live && !processing} />
        <p role="status" className="voice mb-0 mt-[26px] text-ink-muted">
          {processing ? "Turning your voice into text." : chips.length || text ? `${WORDS[chips.length] ?? `${chips.length} things`} so far.` : "Say what is on your mind."}
        </p>
        <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-2 p-0">
          {chips.map((c) => (
            <li key={c.title} className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface py-2 pl-2.5 pr-3.5 text-sm font-semibold leading-5">
              <span className={`size-2 rounded-full ${WHERE[c.location].dot}`} aria-hidden="true" />
              {c.title}
            </li>
          ))}
        </ul>
      </main>
      <div className="flex flex-col items-center gap-1.5 pb-[30px] pt-6">
        <button type="button" aria-label="Done talking" disabled={phase !== "listening"} onClick={() => void done()} className="grid size-[76px] place-items-center rounded-full border-0 bg-ink text-ink-inverse disabled:opacity-40">
          <span className="block size-6 rounded-md bg-ink-inverse" aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold leading-5" aria-hidden="true">Done talking</span>
      </div>
      {phase === "ask" && (
        <Sheet title="Allow the microphone?" voice="Untangle needs your microphone to hear you." onClose={onClose}>
          <div className="flex flex-col gap-3">
            <Button icon="mic" onClick={() => void start()}>Allow microphone</Button>
            <Button variant="secondary" onClick={onClose}>Type instead</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
