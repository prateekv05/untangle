"use client";

import { useState } from "react";
import { factPills } from "@/lib/flow";
import { needsDuration } from "@/lib/guess";
import type { Task } from "@/lib/schemas";
import { fmtDuration } from "@/lib/time";
import { WHERE, WHERE_ORDER, type Where } from "@/lib/where";
import { Chip } from "./chip";
import { Icon } from "./icon";
import { FactPill, TimeChip, WhereTag } from "./where-tag";

export const DURATION_CHOICES = [15, 30, 45, 60, 90, 120];

/** One task on the Understand screen: name, remove, WhereTag (menu), time chip (menu), fact pills. */
export function UnderstandRow({ task, onRemove, onWhere, onDuration }: {
  task: Task; onRemove: () => void; onWhere: (w: Where) => void; onDuration: (min: number | null) => void;
}) {
  const [menu, setMenu] = useState<"where" | "time" | null>(null);
  const ask = needsDuration(task);
  const approx = `${task.durationMin} min`;
  const pills = factPills(task);
  const toggle = (m: "where" | "time") => setMenu((cur) => (cur === m ? null : m));
  return (
    <li className="list-none rounded-md border border-line bg-surface py-3 pl-4 pr-3" data-testid={`row-${task.id}`}>
      <div className="flex items-start gap-2">
        <span className="flex-1 pt-0.5 font-medium">{task.title}</span>
        <button type="button" aria-label={`Remove ${task.title}`} onClick={onRemove} className="-mr-1 -mt-1 grid h-7 w-11 place-items-center border-0 bg-transparent text-ink-muted [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:-mt-2.5">
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <WhereTag where={task.location} chevron onClick={() => toggle("where")} label={`Where: ${WHERE[task.location].label}. Change`} />
        {task.durationSource === "estimated" ? (
          <TimeChip state={ask ? "ask" : "auto"} chevron onClick={() => toggle("time")} label={`How long: about ${approx}. Change`}>
            {ask ? `How long? (~${approx})` : `Auto (~${approx})`}
          </TimeChip>
        ) : (
          <TimeChip state="set" chevron onClick={() => toggle("time")} label={`How long: ${approx}. Change`}>{approx}</TimeChip>
        )}
        {pills.map((p) => <FactPill key={p}>{p}</FactPill>)}
      </div>
      {menu === "where" && (
        <div role="group" aria-label="Where does it happen?" className="mt-2.5 flex flex-wrap gap-2">
          {WHERE_ORDER.map((w) => (
            <Chip key={w} small selected={w === task.location} onClick={() => { onWhere(w); setMenu(null); }}>{WHERE[w].label}</Chip>
          ))}
        </div>
      )}
      {menu === "time" && (
        <div role="group" aria-label="How long does it take?" className="mt-2.5 flex flex-wrap gap-2">
          {DURATION_CHOICES.map((m) => (
            <Chip key={m} small selected={task.durationSource !== "estimated" && m === task.durationMin} onClick={() => { onDuration(m); setMenu(null); }}>{fmtDuration(m)}</Chip>
          ))}
          <Chip small onClick={() => { onDuration(null); setMenu(null); }}>Not sure</Chip>
        </div>
      )}
    </li>
  );
}
