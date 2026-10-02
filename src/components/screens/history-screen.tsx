"use client";

import { useCallback, useEffect, useState } from "react";
import { getHistory, getHistoryDay, type HistoryDay, type HistoryItem } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { fmtMoveDate } from "@/lib/flow";
import { historyDate, historySummary } from "@/lib/history";
import { toMin } from "@/lib/time";
import { Button } from "../button";
import { Icon } from "../icon";
import { WhereTag } from "../where-tag";

type Load<T> = { state: "loading" } | { state: "failed" } | { state: "ready"; value: T };

/** Past days, read-only: the list, then one day as it ended up. Opens over whatever screen the user was on. */
export function HistoryScreen({ onClose }: { onClose: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ground" role="dialog" aria-modal="true" aria-label="History">
      <div className="mx-auto min-h-dvh w-full max-w-[430px]">
        {openId ? <DayView dayId={openId} onBack={() => setOpenId(null)} /> : <DayList onOpen={setOpenId} onClose={onClose} />}
      </div>
    </div>
  );
}

function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <header className="flex h-[58px] items-center px-3 pt-3.5">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 rounded-sm pl-1 pr-3 text-[15px] font-semibold text-ink-muted">
        <Icon name="back" size={20} />
        {label}
      </button>
    </header>
  );
}

function useLoad<T>(load: () => Promise<T>) {
  const [res, setRes] = useState<Load<T>>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    load().then((value) => { if (live) setRes({ state: "ready", value }); }).catch(() => { if (live) setRes({ state: "failed" }); });
    return () => { live = false; };
  }, [load, attempt]);
  const retry = () => { setRes({ state: "loading" }); setAttempt((n) => n + 1); };
  return [res, retry] as const;
}

function DayList({ onOpen, onClose }: { onOpen: (id: string) => void; onClose: () => void }) {
  const [res, retry] = useLoad<HistoryItem[]>(getHistory);
  return (
    <>
      <BackBar label="Back" onBack={onClose} />
      <main className="px-5 pb-10 pt-[22px]">
        <h1 className="m-0 text-[32px] font-bold leading-9 tracking-[-0.02em]">History</h1>
        <p className="voice mb-[18px] mt-2 text-ink-muted">Your days, as they ended up.</p>
        {res.state === "loading" && <div aria-busy="true" aria-label="Loading your history" className="late flex flex-col gap-2"><div className="h-[76px] rounded-md bg-surface-soft" /><div className="h-[76px] rounded-md bg-surface-soft" /><div className="h-[76px] rounded-md bg-surface-soft" /></div>}
        {res.state === "failed" && (
          <div>
            <p role="alert" className="voice m-0 text-ask-ink">I couldn&apos;t load your history. Check your connection, then try again.</p>
            <div className="mt-4"><Button onClick={retry}>Try again</Button></div>
          </div>
        )}
        {res.state === "ready" && res.value.length === 0 && <p className="voice m-0 text-ink-muted">Nothing here yet. Days you plan will show up here.</p>}
        {res.state === "ready" && res.value.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {res.value.map((d) => (
              <li key={d.dayId}>
                <button type="button" onClick={() => onOpen(d.dayId)} className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 text-left">
                  <span>
                    <span className="block font-semibold">{historyDate(d.date)}</span>
                    <span className="block text-sm leading-5 text-ink-muted">{historySummary(d)}</span>
                  </span>
                  <Icon name="back" size={18} className="shrink-0 rotate-180 text-ink-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function DayView({ dayId, onBack }: { dayId: string; onBack: () => void }) {
  const load = useCallback(() => getHistoryDay(dayId), [dayId]);
  const [res, retry] = useLoad<HistoryDay>(load);
  return (
    <>
      <BackBar label="History" onBack={onBack} />
      <main className="px-5 pb-10 pt-[22px]">
        {res.state === "loading" && <div aria-busy="true" aria-label="Loading this day" className="late flex flex-col gap-2"><div className="h-8 w-3/4 rounded-sm bg-surface-soft" /><div className="mt-3 h-[96px] rounded-md bg-surface-soft" /><div className="h-[96px] rounded-md bg-surface-soft" /></div>}
        {res.state === "failed" && (
          <div>
            <p role="alert" className="voice m-0 text-ask-ink">I couldn&apos;t load that day. Check your connection, then try again.</p>
            <div className="mt-4"><Button onClick={retry}>Try again</Button></div>
          </div>
        )}
        {res.state === "ready" && <DayBody day={res.value} />}
      </main>
    </>
  );
}

function DayBody({ day }: { day: HistoryDay }) {
  const byId = new Map(day.tasks.map((t) => [t.id, t]));
  const blocks = [...day.plan.blocks].sort((a, b) => toMin(a.start) - toMin(b.start));
  const moved = day.tasks.filter((t) => t.status === "moved");
  const total = day.tasks.length;
  const done = day.tasks.filter((t) => t.status === "done").length;
  const outing = new Map(day.plan.outings.map((o) => [o.id, o.label]));
  return (
    <>
      <h1 className="m-0 text-[28px] font-bold leading-8 tracking-[-0.02em]">{historyDate(day.date)}</h1>
      <p className="m-0 mt-0.5 text-sm font-medium leading-5 text-ink-muted">{historySummary({ mode: day.mode, total, done, moved: moved.length })}</p>
      <ul className="m-0 mt-[18px] flex list-none flex-col gap-2 p-0">
        {blocks.map((b) => {
          const task = byId.get(b.taskId);
          if (!task) return null;
          const finished = task.status === "done";
          return (
            <li key={b.taskId} className="rounded-md border border-line bg-surface px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="w-[46px] shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-ink-muted">{b.start}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("m-0 font-semibold", finished && "text-ink-muted line-through")}>{task.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <WhereTag where={task.location} />
                    {b.outingId && outing.get(b.outingId) && <span className="text-[13px] font-medium text-ink-muted">{outing.get(b.outingId)}</span>}
                    {finished && <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-muted"><Icon name="check" size={14} weight={2.5} />Done</span>}
                  </div>
                  <p className="voice-sm m-0 mt-1.5 text-ink-muted">{b.reason}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {day.plan.dropped.length > 0 && (
        <section aria-label="Didn't fit" className="mt-3.5 rounded-lg border border-line bg-surface p-4">
          <h2 className="m-0 mb-2 text-lg font-bold leading-6">Didn&apos;t fit</h2>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {day.plan.dropped.map((d) => (
              <li key={d.taskId}>
                <p className="m-0 font-semibold">{byId.get(d.taskId)?.title}</p>
                <p className="voice-sm m-0 text-ink-muted">{d.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {moved.length > 0 && (
        <section aria-label="Moved to a later day" className="mt-3.5 rounded-lg bg-surface-soft p-4">
          <h2 className="m-0 mb-1 text-lg font-bold leading-6">Moved to a later day</h2>
          <ul className="m-0 list-none p-0">
            {moved.map((t) => <li key={t.id} className="min-h-9 py-1 font-medium">{t.title}{t.movedTo && <span className="text-ink-muted">, {fmtMoveDate(t.movedTo)}</span>}</li>)}
          </ul>
        </section>
      )}
    </>
  );
}
