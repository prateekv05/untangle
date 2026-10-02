"use client";

import { useEffect, useState } from "react";
import { getDayOn, type TodayResponse } from "@/lib/api-client";
import { Button } from "./button";
import { DayBody } from "./screens/history-screen";
import { WhereTag } from "./where-tag";

type Load = { state: "loading" } | { state: "failed" } | { state: "ready"; value: TodayResponse };

/** Tomorrow or the day after, read-only: what is planned there, or what is waiting to be planned. Changes are made by adding a dump to that day. */
export function UpcomingDay({ date, name, onAdd }: { date: string; name: string; onAdd: () => void }) {
  const [res, setRes] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    getDayOn(date).then((value) => { if (live) setRes({ state: "ready", value }); }).catch(() => { if (live) setRes({ state: "failed" }); });
    return () => { live = false; };
  }, [date, attempt]);

  if (res.state === "loading") return <div aria-busy="true" aria-label={`Loading ${name}`} className="late flex flex-col gap-2"><div className="h-8 w-3/4 rounded-sm bg-surface-soft" /><div className="mt-3 h-[96px] rounded-md bg-surface-soft" /><div className="h-[96px] rounded-md bg-surface-soft" /></div>;
  if (res.state === "failed") {
    return (
      <div>
        <p role="alert" className="voice m-0 text-ask-ink">I couldn&apos;t load {name}. Check your connection, then try again.</p>
        <div className="mt-4"><Button onClick={() => { setRes({ state: "loading" }); setAttempt((n) => n + 1); }}>Try again</Button></div>
      </div>
    );
  }
  const { day } = res.value;
  const open = day?.tasks.filter((t) => t.status === "open") ?? [];
  return (
    <>
      {day?.plan ? (
        <DayBody day={{ date, mode: day.day.mode, tasks: day.tasks, plan: day.plan.snapshot, plannedAt: "" }} />
      ) : open.length > 0 ? (
        <section aria-label={`Waiting for ${name}`}>
          <p className="voice m-0 text-ink-muted">I have these for {name}, but I haven&apos;t built the day yet.</p>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {open.map((t) => (
              <li key={t.id} className="rounded-md border border-line bg-surface px-4 py-3">
                <p className="m-0 font-semibold">{t.title}</p>
                <div className="mt-1.5"><WhereTag where={t.location} /></div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="voice m-0 text-ink-muted">Nothing planned for {name} yet.</p>
      )}
      <div className="mt-5"><Button variant={day?.plan || open.length > 0 ? "secondary" : "primary"} onClick={onAdd}>{day?.plan || open.length > 0 ? `Add more to ${name}` : `Plan ${name}`}</Button></div>
    </>
  );
}
