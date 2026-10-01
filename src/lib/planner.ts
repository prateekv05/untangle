/**
 * Deterministic day planner. Two jobs:
 *  1. FALLBACK: if the LLM plan fails validation twice, ship this plan so the demo never breaks.
 *  2. REFERENCE: the rules the LLM prompt must follow (see docs/AI_CONTRACT.md).
 * Ported from reference/prototype-v2.html. Pure functions, no I/O.
 */
import type { Block, Plan, Settings, Task } from "./schemas";
import { fmtDuration, toHHMM, toMin } from "./time";

export type PlanMode = "workday" | "dayoff";
export interface PlanOptions {
  mode: PlanMode;
  /** Nothing new may start before this (minutes). Used by re-plan. */
  minStart?: number;
  /** Already-finished blocks. Kept exactly where they are; they occupy their time. */
  fixedBlocks?: Block[];
  /** "I only have 3 hours": max total minutes of non-fixed work. */
  capacityMin?: number | null;
  /** After this time (minutes) allow only ~90 min of non-fixed work ("lighter afternoon"). */
  lighterAfter?: number | null;
  mustFinishTaskIds?: string[];
  /** Per-task duration override, e.g. "60 min left" on an unfinished task. */
  durationOverrides?: Record<string, number>;
}

const LIGHT_BUDGET_MIN = 90;
const GAP = 10;
const DUE_RANK: Record<string, number> = { today: 0, tomorrow: 1, week: 2, none: 3 };
const DUE_TEXT: Record<string, string> = { today: "today", tomorrow: "tomorrow", week: "this week" };
const baseName = (t: string) => t.replace(/\s+(at|@)\s*\d.*$/i, "");

interface Win { n: "morning" | "lunch" | "evening" | "day"; s: number; e: number; p: number; noDeep?: boolean; noTrip?: boolean }
interface Placed { task: Task; start: number; dur: number; reason: string; trip?: boolean; hop?: string; timed?: boolean }

export function planDay(allTasks: Task[], settings: Settings, opts: PlanOptions): Plan {
  const wd = opts.mode === "workday";
  const ws = toMin(settings.workStart), we = toMin(settings.workEnd);
  const wake = toMin(settings.wake), limit = toMin(settings.sleep) - 45;
  const minStart = opts.minStart ?? 0;
  const must = new Set(opts.mustFinishTaskIds ?? []);
  const dur = (t: Task) => opts.durationOverrides?.[t.id] ?? t.durationMin;

  const W: Win[] = [];
  if (wd) {
    if (ws - (wake + 30) >= 30) W.push({ n: "morning", s: wake + 30, e: ws, p: 0 });
    const ls = Math.max(720, ws + 180);
    W.push({ n: "lunch", s: ls, e: ls + 60, p: 0, noDeep: true, noTrip: true });
    W.push({ n: "evening", s: we, e: limit, p: 0 });
  } else W.push({ n: "day", s: wake + 60, e: limit, p: 0 });
  W.forEach((w) => (w.p = Math.max(w.s, minStart)));

  // "Lighter afternoon": clip windows so at most LIGHT_BUDGET_MIN of work sits after lighterAfter.
  if (opts.lighterAfter != null) {
    let budget = LIGHT_BUDGET_MIN;
    for (const w of W) {
      if (w.e <= opts.lighterAfter) continue;
      const from = Math.max(w.s, opts.lighterAfter, w.p);
      const room = Math.max(0, Math.min(w.e - from, budget));
      budget -= room;
      w.e = from + room;
    }
  }

  const busy: { s: number; e: number }[] = [];
  const placed: Placed[] = [];
  const dropped: { taskId: string; why: string }[] = [];
  const dec: string[] = [];
  const done = new Set<string>();

  const slot = (from: number, to: number, d: number): number | null => {
    let c = from;
    for (let i = 0; i < 80; i++) {
      const o = busy.find((b) => c < b.e && c + d > b.s);
      if (!o) break;
      c = o.e + GAP;
    }
    return c + d <= to ? c : null;
  };
  const place = (d: number, o: { deep?: boolean; trip?: boolean } = {}) => {
    for (const w of W) {
      if (o.deep && w.noDeep) continue;
      if (o.trip && w.noTrip) continue;
      const c = slot(w.p, w.e, d);
      if (c != null) { w.p = c + d + GAP; busy.push({ s: c, e: c + d }); return { s: c, w }; }
    }
    return null;
  };
  const add = (t: Task, reason: string, start: number, x: Partial<Placed> = {}) => {
    done.add(t.id); placed.push({ task: t, start, dur: dur(t), reason, ...x });
  };
  const drop = (t: Task, why = "No open window left today. Best bet: first thing tomorrow.", decText?: string) => {
    done.add(t.id); dropped.push({ taskId: t.id, why }); dec.push(decText ?? `${t.title} didn't fit, so it's waiting`);
  };

  // Kept (already finished) blocks occupy their time.
  const kept: Block[] = opts.fixedBlocks ?? [];
  kept.forEach((b) => { done.add(b.taskId); busy.push({ s: toMin(b.start), e: toMin(b.start) + b.durationMin }); });

  // Capacity: keep the highest-priority tasks that fit within the limit, drop the rest.
  let tasks = allTasks.filter((t) => !done.has(t.id));
  if (opts.capacityMin != null) {
    const prio = (t: Task) =>
      t.fixedStart ? 0 : must.has(t.id) ? 1 : t.due === "today" ? 2 : t.due === "tomorrow" ? 3 : t.kind === "deep" ? 4
      : t.kind === "health" ? 6 : t.kind === "chore" ? 7 : 5;
    let used = 0;
    const keep = new Set<string>();
    [...tasks].sort((a, b) => prio(a) - prio(b)).forEach((t) => {
      if (t.fixedStart || used + dur(t) <= opts.capacityMin!) { keep.add(t.id); used += dur(t); }
    });
    tasks.filter((t) => !keep.has(t.id)).forEach((t) =>
      drop(t, `Over your ${fmtDuration(opts.capacityMin!)} limit. It moves to a later day.`, `${t.title} waits: you only have ${fmtDuration(opts.capacityMin!)}`));
    tasks = tasks.filter((t) => keep.has(t.id));
  }

  // 1. Fixed times anchor the day.
  tasks.filter((t) => t.fixedStart && !done.has(t.id)).sort((a, b) => toMin(a.fixedStart!) - toMin(b.fixedStart!)).forEach((t) => {
    const at = toMin(t.fixedStart!);
    if (at < minStart) return drop(t, `It was at ${t.fixedStart}, before the rebuilt time. Worth rescheduling.`, `${t.title} (${t.fixedStart}) is already past, so it needs rescheduling`);
    add(t, `You said it's at ${t.fixedStart}, so the rest of the day works around it.`, at, { timed: true });
    busy.push({ s: at, e: at + dur(t) });
    dec.push(`Built the day around ${baseName(t.title).toLowerCase()} at ${t.fixedStart}`);
  });

  // 2. An outside appointment is the first stop of the outing: chain the rest right after it.
  let bundled = false;
  {
    const out0 = tasks.filter((t) => t.location === "outside" && !done.has(t.id));
    const seq0 = [...out0.filter((t) => t.kind === "health"), ...out0.filter((t) => t.kind !== "health")];
    const anchor = placed.find((p) => p.timed && p.task.location === "outside");
    if (seq0.length && anchor) {
      const nm = baseName(anchor.task.title).toLowerCase();
      const start = anchor.start + anchor.dur + GAP;
      const total = seq0.reduce((a, t) => a + dur(t), 0) + GAP * (seq0.length - 1);
      const end = start + total;
      const free = !busy.some((b) => start < b.e && end > b.s) && end <= limit && start >= minStart && (!wd || start >= we || end <= ws);
      if (free) {
        let p = start;
        seq0.forEach((t, i) => {
          add(t, i === 0 ? `You're already out for your ${nm}, so this goes right after. No extra trip.` : "Same outing, next stop.", p, { trip: true, hop: i === 0 ? `right after your ${nm}` : "next stop" });
          p += dur(t) + GAP;
        });
        busy.push({ s: start, e: end });
        anchor.trip = true; bundled = true;
        dec.push(`Chained ${seq0.length} outside task${seq0.length > 1 ? "s" : ""} right after your ${nm}, so you only go out once`);
      }
    }
  }

  // 3. Work-located tasks.
  const workT = tasks.filter((t) => t.location === "work" && !done.has(t.id));
  if (wd) workT.forEach((t) => {
    const c = slot(Math.max(ws, minStart), we, dur(t));
    if (c != null) { busy.push({ s: c, e: c + dur(t) }); add(t, "Needs to happen at work, so it sits inside your working hours.", c); } else drop(t);
  });
  else workT.forEach((t) => {
    const r = place(dur(t));
    r ? add(t, "Marked as work, but it's a day off. Move it if it can wait.", r.s) : drop(t);
  });

  // 4. Focus work, most urgent first.
  const rank = (t: Task) => (must.has(t.id) ? -1 : DUE_RANK[t.due ?? "none"] ?? 3);
  tasks.filter((t) => t.kind === "deep" && !done.has(t.id)).sort((a, b) => rank(a) - rank(b)).forEach((t, i) => {
    const r = place(dur(t), { deep: true });
    if (!r) return drop(t);
    let why: string;
    if (must.has(t.id)) { why = "You said this has to get done today, so it gets a long stretch early."; dec.push(`${t.title} is protected: you said it must get done today`); }
    else if (rank(t) < 2) { why = `Due ${DUE_TEXT[t.due!]}, so it gets the first long stretch you have.`; dec.push(`${t.title} goes first because it's due ${DUE_TEXT[t.due!]}`); }
    else if (!wd) why = i === 0 ? "Hardest thing on your list, so it goes first while you're fresh." : "Another focus task, kept with the first one.";
    else why = r.w.n === "morning" ? "Hardest task, so it gets your clearest hours before work starts." : "Needs a long, quiet stretch. This is the biggest open window after work.";
    if (i === 0 && rank(t) >= 2 && !must.has(t.id)) dec.push(`${t.title} goes in ${r.w.n === "evening" ? "your longest quiet stretch" : "your freshest hours"}`);
    add(t, why, r.s);
  });

  // 5. The one outing (normal case): health first, then errands, so errands come on the way back.
  const out = tasks.filter((t) => t.location === "outside" && !done.has(t.id));
  const seq = [...out.filter((t) => t.kind === "health"), ...out.filter((t) => t.kind !== "health")];
  if (seq.length && !bundled) {
    const total = seq.reduce((a, t) => a + dur(t), 0) + GAP * (seq.length - 1);
    const r = place(total, { trip: true });
    if (!r) seq.forEach((t) => drop(t));
    else {
      let p = r.s;
      seq.forEach((t, i) => {
        let why: string;
        if (i === 0) why = t.kind === "health" ? "Starts your one trip out of the house. Everything else outside is chained to it." : "Starts your one trip out. The other errands are bundled with it.";
        else if (seq[0].kind === "health") why = `You're already out at the ${seq[0].title.toLowerCase().split(" ")[0]}, so this goes on the way back home. No second trip.`;
        else why = "Same outing as the first stop, so you only leave the house once.";
        add(t, why, p, { trip: true, hop: i > 0 ? (seq[0].kind === "health" ? "on the way back" : "next stop") : undefined });
        p += dur(t) + GAP;
      });
      if (seq.length > 1) dec.push(`Bundled ${seq.length} outside tasks into one outing`);
    }
  }

  // 6. Quick tasks, calls, home tasks, anything left.
  tasks.filter((t) => t.kind === "admin" && t.location === "anywhere" && !done.has(t.id)).forEach((t) => {
    const r = place(dur(t));
    if (!r) return drop(t);
    if (r.w.n === "lunch") { add(t, "Quick one. Fits in your lunch break.", r.s); dec.push(`Put ${t.title} in your lunch break`); }
    else add(t, "Small task, tucked into a spare gap.", r.s);
  });
  tasks.filter((t) => t.kind === "call" && !done.has(t.id)).forEach((t) => {
    const r = place(dur(t));
    if (!r) return drop(t);
    if (r.w.n === "lunch") { add(t, "Lunch break is an easy time to step away and call.", r.s); dec.push(`Put ${t.title} in your lunch break`); }
    else add(t, "Calling when the day has wound down, so you can actually talk.", r.s);
  });
  tasks.filter((t) => t.location === "home" && !done.has(t.id)).forEach((t) => {
    const r = place(dur(t)); r ? add(t, "Home task, placed once you are back.", r.s) : drop(t);
  });
  tasks.filter((t) => !done.has(t.id)).forEach((t) => { const r = place(dur(t)); r ? add(t, "Fits in a spare gap.", r.s) : drop(t); });

  if (minStart > 0) dec.unshift(`Rebuilt the rest of your day from ${toHHMM(minStart)}`);

  const hasTrip = placed.some((p) => p.trip);
  const blocks: Block[] = [
    ...kept,
    ...placed.map((p) => ({
      taskId: p.task.id, start: toHHMM(p.start), durationMin: p.dur,
      outingId: p.trip ? "outing-1" : null, reason: p.reason, hop: p.hop ?? null,
    })),
  ].sort((a, b) => toMin(a.start) - toMin(b.start));

  const guessed = placed.filter((p) => p.task.durationSource === "estimated" && (p.task.kind === "health" || p.task.kind === "deep")).map((p) => p.task.title);
  const g = guessed.length > 2 ? [guessed[0], `${guessed[1]} and ${guessed.length - 2} more`] : guessed;
  return {
    blocks,
    outings: hasTrip ? [{ id: "outing-1", label: "One outing" }] : [],
    decisions: dec.slice(0, 6),
    dropped,
    note: guessed.length ? `I guessed the time for ${g.join(guessed.length > 2 ? ", " : " and ")}. Set your own and I will re-plan.` : null,
  };
}

/** For "was 09:00" pills: previous start per task. */
export function diffStarts(prev: Plan | null, next: Plan): Record<string, string> {
  const was: Record<string, string> = {};
  if (!prev) return was;
  const old = new Map(prev.blocks.map((b) => [b.taskId, b.start]));
  next.blocks.forEach((b) => { const o = old.get(b.taskId); if (o && o !== b.start) was[b.taskId] = o; });
  return was;
}
