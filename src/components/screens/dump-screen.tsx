"use client";

import { useId, useRef } from "react";
import { BUILT_IN_PRESETS, countThings, type Preset } from "@/lib/guess";
import { Button } from "../button";
import { Chip } from "../chip";
import { Icon } from "../icon";
import { TopBar } from "../top-bar";

const QUICK = ["Call", "Buy", "Go to", "Order", "Email"].map((n) => BUILT_IN_PRESETS.find((p) => p.phrase === n)!);
const PLACEHOLDER = "SQL assignment, gym, groceries, call Mom, send resume to Sarah, work on my app, buy toothpaste…";

export const countLabel = (n: number): string => (n === 0 ? "Nothing yet" : n === 1 ? "1 thing so far" : `${n} things so far`);

export function DumpScreen({ text, onText, onMic, onSubmit, onSettings, onYours, presets, carried = [], onCarry, notice, examples, onExample, name, offline }: {
  text: string; onText: (t: string) => void; onMic: () => void; onSubmit: () => void; onSettings: () => void; onYours: () => void;
  presets: Preset[]; carried?: string[]; onCarry?: (title: string) => void; notice?: string | null;
  examples?: { label: string; text: string }[]; onExample?: (text: string) => void; name?: string | null; offline?: boolean;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const noticeId = useId();
  const n = countThings(text);
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
        <p className="mb-[18px] mt-2.5 text-ink-muted">Say it or type it, in any order. I&apos;ll untangle it.</p>
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
            value={text}
            onChange={(e) => onText(e.target.value.slice(0, 4000))}
            placeholder={PLACEHOLDER}
            className="min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-0 text-xl leading-[30px] outline-none placeholder:text-ink-muted"
          />
          <div className="flex items-center justify-between">
            <span aria-live="polite" className="text-[13px] font-medium leading-[18px] text-ink-muted">{countLabel(n)}</span>
            <button type="button" aria-label="Tap to talk" disabled={offline} onClick={onMic} className="grid size-[68px] place-items-center rounded-full border-0 bg-ink text-ink-inverse">
              <Icon name="mic" size={30} />
            </button>
          </div>
        </div>
        {notice && <p id={noticeId} role="status" className="m-0 mt-2 text-sm font-medium text-danger">{notice}</p>}
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
          <Button disabled={n < 1 || offline} onClick={onSubmit}>Untangle my day</Button>
        </div>
      </main>
    </div>
  );
}
