"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { FactPill, TimeChip } from "@/components/where-tag";
import type { Where } from "@/lib/where";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/** The re-plan loop, scripted: no API calls, nothing is stored. Three sentences, three rebuilt days. */

const ROW = 52;

type RowId = "done" | "now" | "numbers" | "bill" | "plumber" | "out" | "wash" | "mom";
type Kind = "done" | "now";
type Opts = { name?: string; sub?: string; was?: string; pill?: string; later?: string };
type Entry = [RowId, string, Opts?];

const ROWS: Record<RowId, { name: string; loc: Where; sub?: string; kind?: Kind }> = {
  done: { name: "", loc: "outside", kind: "done" },
  now: { name: "", loc: "anywhere", kind: "now" },
  numbers: { name: "Send the numbers", loc: "work" },
  bill: { name: "Pay electric bill", loc: "anywhere" },
  plumber: { name: "Plumber visit", loc: "home" },
  out: { name: "One outing", sub: "3 stops", loc: "outside" },
  wash: { name: "Laundry", loc: "home" },
  mom: { name: "Call Mom", loc: "anywhere" },
};
const IDS = Object.keys(ROWS) as RowId[];

const BASE: { note: string; rows: Entry[] } = {
  note: "Planned at 08:30",
  rows: [["numbers", "09:00"], ["bill", "10:45"], ["out", "12:30"], ["wash", "15:00"], ["mom", "17:30"]],
};

type Scenario = { label: string; said: string; note: string; rows: Entry[]; changes: string[] };
const SCENARIOS: Record<string, Scenario> = {
  plumber: {
    label: "I didn't send the numbers. Plumber at 2.", said: "I didn't send the numbers. Plumber at 2.", note: "Re-planned at 12:20",
    rows: [["done", "", { name: "1 finished" }], ["now", "", { name: "Now, 12:20" }], ["numbers", "12:30", { was: "09:00", sub: "45 min left" }],
      ["plumber", "14:00", { pill: "Fixed" }], ["out", "15:15", { was: "12:30" }], ["wash", "16:45", { was: "15:00" }], ["mom", "17:30"]],
    changes: ["Kept the numbers with the 45 min you have left.", "Planned around the plumber at 14:00.", "Moved the outing to 15:15, after the plumber leaves."],
  },
  late: {
    label: "I'm running 90 minutes late.", said: "I'm running 90 minutes late.", note: "Re-planned at 09:00",
    rows: [["now", "", { name: "Now, 09:00" }], ["numbers", "10:30", { was: "09:00" }], ["bill", "12:15", { was: "10:45" }],
      ["out", "13:00", { was: "12:30" }], ["wash", "15:30", { was: "15:00" }], ["mom", "17:30"]],
    changes: ["Started your day at 10:30, still with the numbers first.", "Shortened lunch so the outing still fits.", "Call Mom stays at 17:30."],
  },
  lighter: {
    label: "Give me a lighter afternoon.", said: "Give me a lighter afternoon.", note: "Re-planned at 12:20",
    rows: [["done", "", { name: "2 finished" }], ["now", "", { name: "Now, 12:20" }], ["out", "12:30"], ["mom", "17:30"], ["wash", "", { later: "tomorrow" }]],
    changes: ["Kept the outing, you were about to head out.", "Moved Laundry to tomorrow.", "Left about 90 min for the rest of your afternoon."],
  },
};

type Phase = "idle" | "typing" | "done";

function positions(rows: Entry[]): Partial<Record<RowId, number>> {
  return Object.fromEntries(rows.map(([id], i) => [id, i * ROW]));
}

export function ReplanDemo() {
  const reduced = useReducedMotion();
  const [key, setKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState(0);
  // Where each row last was, so a row that leaves fades out in place instead of flying to the top.
  const [pos, setPos] = useState<Partial<Record<RowId, number>>>(() => positions(BASE.rows));

  const s = key ? SCENARIOS[key] : null;
  const showing = phase === "done" && s ? s : null;
  const rows = showing ? showing.rows : BASE.rows;

  const show = (next: Entry[]) => setPos((p) => ({ ...p, ...positions(next) }));

  useEffect(() => {
    if (phase !== "typing" || !s) return;
    const t = setTimeout(() => {
      if (typed < s.said.length) setTyped(typed + 1);
      else { setPhase("done"); setPos((p) => ({ ...p, ...positions(s.rows) })); }
    }, typed < s.said.length ? 32 : 450);
    return () => clearTimeout(t);
  }, [phase, typed, s]);

  function run(k: string) {
    setKey(k);
    show(BASE.rows);
    if (reduced) { setTyped(SCENARIOS[k].said.length); setPhase("done"); show(SCENARIOS[k].rows); return; }
    setTyped(0);
    setPhase("typing");
  }
  function reset() {
    setKey(null); setPhase("idle"); setTyped(0); show(BASE.rows);
  }

  // The spine runs from the first to the last timed row.
  const timedAt = rows.flatMap(([id, , o], i) => (!ROWS[id].kind && !o?.later ? [i] : []));
  const first = timedAt[0] ?? 0;
  const last = timedAt[timedAt.length - 1] ?? 0;
  const busy = phase === "typing";

  return (
    <>
      <div>
        <p className="kicker">Re-plan, the part that matters</p>
        <h2 id="rp-h">Plans change. Tell it what happened.</h2>
        <p className="sub">One sentence, typed or spoken. Untangle keeps what you finished, plans around what&apos;s new and shows you exactly what moved.</p>
        <div className="chips" role="group" aria-label="Try a re-plan">
          {Object.entries(SCENARIOS).map(([k, sc]) => (
            <Button key={k} variant="pill" aria-pressed={key === k} disabled={busy} onClick={() => run(k)}>{sc.label}</Button>
          ))}
        </div>
      </div>

      <div className="demo">
        <div className="said" aria-hidden="true">
          <span className={`txt${s ? " on" : ""}`}>
            {s ? s.said.slice(0, typed) : "What changed?"}
            {busy && <span className="caret" />}
          </span>
          <Icon name="mic" className="ic" />
        </div>
        <div className="dthread" aria-hidden="true" style={{ height: rows.length * ROW }}>
          <span className="spine" style={{ top: first * ROW + ROW / 2, height: Math.max(0, (last - first) * ROW) }} />
          {IDS.map((id) => {
            const base = ROWS[id];
            const i = rows.findIndex(([r]) => r === id);
            const entry = i >= 0 ? rows[i] : null;
            const o = entry?.[2] ?? {};
            const cls = ["drow", !entry && "gone", base.kind, o.later && "later"].filter(Boolean).join(" ");
            const extra = o.was ? <FactPill>was {o.was}</FactPill> : o.pill ? <TimeChip state="set">{o.pill}</TimeChip> : o.later ? <FactPill>{o.later}</FactPill> : null;
            return (
              <div key={id} className={cls} style={{ transform: `translateY(${pos[id] ?? 0}px)`, "--c": `var(--thread-${base.loc})` } as CSSProperties}>
                <span className="time">{entry?.[1]}</span>
                <span className="rail"><span className="node">{base.kind === "done" && <Icon name="check" size={11} weight={3.5} />}</span></span>
                {base.kind === "now" ? (
                  <><span className="nowpill">{o.name}</span><span /></>
                ) : (
                  <>
                    <span className="name">{base.kind === "done" ? o.name : base.name}{(o.sub ?? base.sub) && base.kind !== "done" && <small>{o.sub ?? base.sub}</small>}</span>
                    <span className="extra">{extra}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="changed" aria-live="polite">
          {showing ? (
            <>
              <div className="hd">Here is what I changed</div>
              <ul>{showing.changes.map((c, i) => <li key={c} style={{ "--i": i } as CSSProperties}>{c}</li>)}</ul>
            </>
          ) : (
            <>
              <div className="hd">Your day, as planned</div>
              <p className="idle">Tap one of the sentences to see the rest of the day rebuild around it.</p>
            </>
          )}
        </div>
        <div className="demo-foot">
          <span className="note">{showing ? showing.note : BASE.note}</span>
          {showing && <Button variant="quiet" onClick={reset}>Undo</Button>}
        </div>
      </div>
    </>
  );
}
