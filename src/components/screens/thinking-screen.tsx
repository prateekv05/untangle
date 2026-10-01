"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { PlanMode } from "@/lib/planner";
import type { Settings, Task } from "@/lib/schemas";
import { TopBar } from "../top-bar";

const STEP_MS = 700;

export function thinkingSteps(kind: "dump" | "plan", tasks: Task[], n: number, mode: PlanMode, settings: Settings): { title: string; steps: string[] } {
  if (kind === "dump") {
    return { title: "Reading your list", steps: [`Reading ${n} ${n === 1 ? "thing" : "things"}`, "Working out where each one happens", "Finding what belongs together"] };
  }
  const outside = tasks.filter((t) => t.location === "outside").length;
  return {
    title: "Untangling your day",
    steps: [
      `Looking at ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`,
      outside >= 2 ? `Bundling ${outside} outside tasks into one outing` : "Checking what needs you out",
      mode === "workday" ? `Fitting around ${settings.workStart} to ${settings.workEnd}` : "Spreading the day out",
      "Writing down why",
    ],
  };
}

/** Steps tick on in order. Phase 1: time-based; later phases finish early if the call returns early. */
export function ThinkingScreen({ title, steps, onDone, stepMs = STEP_MS }: { title: string; steps: string[]; onDone: () => void; stepMs?: number }) {
  const [done, setDone] = useState(0);
  const finish = useRef(onDone);
  useEffect(() => { finish.current = onDone; });
  useEffect(() => {
    if (done >= steps.length) { const t = setTimeout(() => finish.current(), 450); return () => clearTimeout(t); }
    const t = setTimeout(() => setDone((d) => d + 1), stepMs);
    return () => clearTimeout(t);
  }, [done, steps.length, stepMs]);
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar hideSettings />
      <main className="flex-1 px-5 pt-[22px]" role="status" aria-live="polite">
        <h1 className="m-0 text-4xl font-bold leading-[38px] tracking-[-0.02em]">{title}</h1>
        <ol className="m-0 mt-8 flex list-none flex-col gap-4 p-0">
          {steps.map((s, i) => {
            const state = i < done ? "done" : i === done ? "active" : "waiting";
            return (
              <li key={s} className={cn("flex items-center gap-3 text-lg leading-6 transition-opacity duration-200", state === "waiting" && "opacity-0")}>
                {state === "done" ? (
                  <span className="size-3.5 rounded-full bg-outside" aria-hidden="true" />
                ) : (
                  <span className="spin size-3.5 rounded-full border-2 border-line border-t-ink" aria-hidden="true" />
                )}
                <span className={state === "done" ? "text-ink-muted" : "font-medium"}>{s}</span>
                <span className="sr-only">{state === "done" ? "done" : ""}</span>
              </li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}
