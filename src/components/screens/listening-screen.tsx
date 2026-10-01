"use client";

import { useEffect, useRef, useState } from "react";
import { MOCK_TRANSCRIPT } from "@/fixtures/example";
import { WHERE } from "@/lib/where";
import { Icon } from "../icon";
import { Waveform } from "../waveform";

const WORDS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things", "Six things", "Seven things"];
const LOCATION = ["anywhere", "outside", "anywhere", "outside", "anywhere", "anywhere"] as const;
export const LIMIT_SECONDS = 120;
const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Mock recording: no microphone is opened. A timer reveals the fixture transcript and heard-so-far chips.
 * Phase 8 swaps this for the real Transcriber (docs/VOICE.md).
 */
export function ListeningScreen({ onClose, onDone, onLimit, startAt = 0 }: { onClose: () => void; onDone: () => void; onLimit: () => void; startAt?: number }) {
  const [seconds, setSeconds] = useState(startAt);
  const limited = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (seconds >= LIMIT_SECONDS && !limited.current) { limited.current = true; onLimit(); }
  }, [seconds, onLimit]);

  const words = MOCK_TRANSCRIPT.said.split(" ");
  const shown = Math.min(words.length, 4 + seconds * 3);
  const finished = shown >= words.length;
  const heard = Math.min(MOCK_TRANSCRIPT.heard.length, Math.floor((shown / words.length) * (MOCK_TRANSCRIPT.heard.length - 1)) + (finished ? 1 : 0));
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-[58px] items-center justify-between px-3 pt-3.5">
        <button type="button" aria-label="Cancel" onClick={onClose} className="grid size-11 place-items-center rounded-sm text-ink"><Icon name="close" size={22} /></button>
        <span className="text-[15px] font-semibold leading-5">Listening</span>
        <span className="w-11 pr-2 text-right text-[15px] font-semibold leading-5 tabular-nums text-ink-muted" aria-label={`${seconds} seconds`}>{fmtClock(seconds)}</span>
      </header>
      <main className="flex-1 px-5 pt-2.5">
        <span className="inline-block rounded-pill bg-surface-soft px-2.5 py-1 text-[13px] font-semibold leading-[18px] text-ink-muted">{MOCK_TRANSCRIPT.planningFor}</span>
        <p aria-live="off" className="m-0 mt-5 text-[21px] font-medium leading-[30px]">
          {words.slice(0, shown).join(" ")}
          {finished && <> <span className="text-ink-muted">{MOCK_TRANSCRIPT.newest}</span></>}
        </p>
        <Waveform />
        <p role="status" className="voice mb-0 mt-[26px] text-ink-muted">{WORDS[heard]} so far.</p>
        <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-2 p-0">
          {MOCK_TRANSCRIPT.heard.slice(0, heard).map((h, i) => (
            <li key={h} className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface py-2 pl-2.5 pr-3.5 text-sm font-semibold leading-5">
              <span className={`size-2 rounded-full ${WHERE[LOCATION[i]].dot}`} aria-hidden="true" />
              {h}
            </li>
          ))}
        </ul>
      </main>
      <div className="flex flex-col items-center gap-1.5 pb-[30px] pt-6">
        <button type="button" aria-label="Done talking" onClick={onDone} className="grid size-[76px] place-items-center rounded-full border-0 bg-ink text-ink-inverse">
          <span className="block size-6 rounded-md bg-ink-inverse" aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold leading-5" aria-hidden="true">Done talking</span>
      </div>
    </div>
  );
}
