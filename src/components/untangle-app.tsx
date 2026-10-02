"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { ApiError, deletePreset, getDraft, getPresets, getSettings, getToday, patchTask, postDayEdit, postDayUndo, postPlan, postPreset, postReplan, postUnderstand, putSettings, type PlanResponse, type UnderstandResponse } from "@/lib/api-client";
import { APPOINTMENT_DUMP, EXAMPLE_DUMP } from "@/fixtures/example";
import { browserTimezone, nowMinutes } from "@/lib/clock";
import { resolveMoveTarget } from "@/lib/day-edit";
import { draftFrom, type DraftPayload } from "@/lib/draft";
import type { DayEditBody, PlanForDay } from "@/lib/api-schemas";
import type { ReplanView } from "@/lib/day-response";
import { fmtMoveDate, initialState, reducer } from "@/lib/flow";
import { countThings } from "@/lib/guess";
import type { Preset } from "@/lib/guess";
import type { Question, Task } from "@/lib/schemas";
import { localClock } from "@/lib/timezone";
import { toHHMM } from "@/lib/time";
import { useDraftSave } from "@/lib/use-draft-save";
import { useOnline } from "@/lib/use-online";
import type { Where } from "@/lib/where";
import { DumpScreen } from "./screens/dump-screen";
import { PlanScreen } from "./screens/plan-screen";
import { ThinkingScreen, thinkingSteps } from "./screens/thinking-screen";
import { UnderstandScreen } from "./screens/understand-screen";
import { EditSheet } from "./sheets/edit-sheet";
import { MoveSheet } from "./sheets/move-sheet";
import { NewDumpSheet } from "./sheets/new-dump-sheet";
import { PasswordSheet } from "./sheets/password-sheet";
import { PresetsSheet } from "./sheets/presets-sheet";
import { ReplanSheet } from "./sheets/replan-sheet";
import { HistoryScreen } from "./screens/history-screen";
import { SettingsSheet } from "./sheets/settings-sheet";
import { BootSkeleton } from "./boot-skeleton";
import { OfflineNote } from "./offline-note";
import { Toast } from "./toast";

const noopSubscribe = () => () => {};

const EXAMPLES = [
  { label: "Try an example", text: EXAMPLE_DUMP },
  { label: "With an appointment", text: APPOINTMENT_DUMP },
];

/**
 * Every screen as one client state machine (src/lib/flow.ts). Understanding runs on the real model (/api/understand);
 * planning still runs on fixtures until Phase 5; settings and presets are the signed-in account's own and are saved through /api.
 */

export function UntangleApp({ name = null }: { name?: string | null }) {
  const [s, dispatch] = useReducer(reducer, undefined, () => {
    const init = initialState();
    return { ...init, settings: { ...init.settings, timezone: browserTimezone() } };
  });
  const search = useSyncExternalStore(noopSubscribe, () => window.location.search, () => "");
  const demo = new URLSearchParams(search).get("demo") === "1";
  const offline = !useOnline();
  const [micOnOpen, setMicOnOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; retry: boolean } | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [hasPassword, setHasPassword] = useState(false);
  // Settings open only once the account's own values are in, so an early tap cannot save defaults over them.
  const [account, setAccount] = useState<"loading" | "ready" | "failed">("loading");
  // Today's saved day comes back on open; tasks moved to today from an earlier day are offered on the Dump screen.
  const [booted, setBooted] = useState(false);
  const [carriedTitles, setCarriedTitles] = useState<string[]>([]);
  const carried = carriedTitles.filter((c) => !taken.includes(c));
  // The unfinished list is saved to the account as it changes. A draft found on open waits behind a Continue card; nothing overwrites it until the user types or starts fresh.
  const [pendingDraft, setPendingDraft] = useState<DraftPayload | null>(null);
  const [understandDayId, setUnderstandDayId] = useState<string | null>(null);
  const draftPayload = useMemo(
    () => draftFrom({ screen: s.screen, text: s.text, mode: s.mode, tasks: s.tasks, questions: s.questions, groupings: s.groupings }, understandDayId),
    [s.screen, s.text, s.mode, s.tasks, s.questions, s.groupings, understandDayId],
  );
  const draftSave = useDraftSave(draftPayload, booted && !(pendingDraft && s.text === ""));
  const { markExisting } = draftSave;
  if (pendingDraft && s.text !== "") setPendingDraft(null); // typing replaces the saved draft, so the offer is gone for good
  useEffect(() => {
    let live = true;
    const draftLoad = getDraft()
      .then((d) => { if (live && d) { setPendingDraft(d); markExisting(); } })
      .catch(() => {}); // no draft to offer: the Dump screen is the right place to start
    getToday()
      .then((res) => {
        if (!live) return;
        setCarriedTitles(res.carried.map((t) => t.title));
        const { day } = res;
        if (day?.plan) {
          const at = new Date(day.plan.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
          const tasks = day.tasks.map((t) => ({ ...t, movedTo: t.movedTo ?? null }));
          dispatch({ type: "loaded", view: { dayId: day.day.id, mode: day.day.mode, tasks, plan: day.plan.snapshot, version: day.plan.version, source: "llm", model: null, plannedAt: at } });
        }
      })
      .catch(() => {}) // no saved day to show: the Dump screen is the right place to start
      .finally(() => { void draftLoad.then(() => { if (live) setBooted(true); }); });
    return () => { live = false; };
  }, [markExisting]);

  // Settings and presets belong to the account: load them, then save changes optimistically and roll back on failure.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([getSettings(), getPresets()])
      .then(([settings, presets]) => {
        if (!live) return;
        dispatch({ type: "settings", settings });
        dispatch({ type: "presets", presets });
        setAccount("ready");
      })
      .catch(() => {
        if (live) setAccount("failed"); // Settings still opens (Sign out lives there) but shows no editable values
      });
    return () => { live = false; };
  }, [attempt]);
  const retryLoad = () => { setAccount("loading"); setAttempt((n) => n + 1); };
  const saveSettings = (settings: typeof s.settings) => {
    const before = s.settings;
    dispatch({ type: "settings", settings });
    closeSheet();
    putSettings(settings).catch(() => {
      dispatch({ type: "settings", settings: before });
      dispatch({ type: "toast", text: "I couldn't save your settings. They are back as they were." });
    });
  };
  const addPreset = (p: Omit<Preset, "id">) => {
    const temp: Preset = { ...p, id: `tmp-${Date.now()}` };
    dispatch({ type: "presetAdd", preset: temp });
    postPreset(p)
      .then((preset) => dispatch({ type: "presetSaved", tempId: temp.id, preset }))
      .catch(() => {
        dispatch({ type: "presetDrop", id: temp.id });
        dispatch({ type: "toast", text: "I couldn't save that preset." });
      });
  };
  const removePreset = (id: string) => {
    const removed = s.presets.find((x) => x.id === id);
    if (!removed) return;
    dispatch({ type: "presetDrop", id });
    if (id.startsWith("tmp-")) return; // never reached the server
    deletePreset(id).catch(() => {
      dispatch({ type: "presetRestore", preset: removed });
      dispatch({ type: "toast", text: "I couldn't delete that preset." });
    });
  };

  const now = useCallback(() => nowMinutes(window.location.search), []);
  const today = useMemo(() => new Date(), []);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [forDay, setForDay] = useState<PlanForDay>("today");
  const closeSheet = () => dispatch({ type: "sheet", sheet: null });
  const openSettings = () => dispatch({ type: "sheet", sheet: { type: "settings" } });

  // The understand call runs while the thinking screen plays. `run` guards against a stale answer after a retry.
  const understandRun = useRef(0);
  const understood = useRef<UnderstandResponse | null>(null);
  const [understandReady, setUnderstandReady] = useState(false);
  const startUnderstand = (text: string) => {
    const run = ++understandRun.current;
    understood.current = null;
    setUnderstandReady(false);
    setNotice(null);
    dispatch({ type: "text", text });
    dispatch({ type: "think", kind: "dump" });
    postUnderstand(text.trim(), forDay)
      .then((res) => {
        if (run !== understandRun.current) return;
        understood.current = res;
        setUnderstandReady(true);
      })
      .catch((e) => {
        if (run !== understandRun.current) return;
        // The text stays in the box. Nothing here is a dead end: the user can try again straight away.
        const limit = e instanceof ApiError && e.status === 429;
        setNotice({
          text: limit ? "That's today's limit for reading lists. Your text is saved. Try again tomorrow." : "I couldn't read that just now. Your text is saved. Try again.",
          retry: !limit, // trying again tomorrow is not a button
        });
        dispatch({ type: "screen", screen: "dump" });
      });
  };
  const submitDump = () => {
    if (countThings(s.text) < 1) return;
    startUnderstand(s.text);
  };
  const continueDraft = () => {
    if (!pendingDraft) return;
    setUnderstandDayId(pendingDraft.dayId);
    dispatch({ type: "restoreDraft", draft: pendingDraft });
    setPendingDraft(null);
  };
  const saveForLater = async () => {
    const ok = await draftSave.saveNow();
    dispatch({ type: "toast", text: ok ? "Saved for later. It will be here when you come back." : "I couldn't save that just now. Check your connection and try again." });
  };
  const finishDumpThinking = useCallback(() => {
    const res = understood.current;
    if (!res) return;
    setUnderstandDayId(res.dayId);
    dispatch({ type: "understood", tasks: res.tasks, questions: res.questions, groupings: res.groupings, mode: res.mode });
  }, []);

  // Understand edits are saved to the day as they happen. Tasks added here have no saved id yet (Phase 5 syncs them).
  const isSaved = (id: string) => /^[0-9a-f-]{36}$/.test(id);
  const savePatch = (taskId: string, patch: Partial<Task>) => {
    if (!isSaved(taskId)) return;
    patchTask(taskId, patch).catch(() => dispatch({ type: "toast", text: "I couldn't save that change. It still applies here." }));
  };
  const answer = (question: Question, value: string | number | null) => {
    dispatch({ type: "answer", question, value });
    if (value === null) return;
    if (question.type === "due") savePatch(question.taskId, { due: value as Task["due"] });
    else if (question.type === "duration") savePatch(question.taskId, { durationMin: value as number, durationSource: "user" });
    else savePatch(question.taskId, { fixedStart: String(value), durationSource: "user" });
  };
  const patch = (taskId: string, p: Partial<Task>) => {
    dispatch({ type: "patchTask", taskId, patch: p, now: now() });
    savePatch(taskId, p);
  };

  // The plan call runs while the thinking screen plays. Nothing is shown until the server has validated the plan.
  const planRun = useRef(0);
  const planned = useRef<PlanResponse | null>(null);
  const [planReady, setPlanReady] = useState(false);
  const startPlan = () => {
    const dayId = understandDayId;
    if (!dayId) return;
    const run = ++planRun.current;
    planned.current = null;
    setPlanReady(false);
    dispatch({ type: "think", kind: "plan" });
    postPlan(dayId, s.mode, s.tasks)
      .then((res) => {
        if (run !== planRun.current) return;
        planned.current = res;
        setPlanReady(true);
      })
      .catch((e) => {
        if (run !== planRun.current) return;
        dispatch({ type: "screen", screen: "understand" });
        dispatch({ type: "toast", text: e instanceof ApiError && e.status === 429
          ? "That's today's limit for building days. Your list is saved. Try again tomorrow."
          : "I couldn't build your day just now. Your list is saved. Try again." });
      });
  };
  const finishPlanThinking = useCallback(() => {
    const res = planned.current;
    if (!res) return;
    draftSave.clear();
    dispatch({ type: "planned", dayId: understandDayId ?? "", version: res.version, plan: res.plan, tasks: res.tasks, mode: res.mode, plannedAt: res.plannedAt, done: res.done });
  }, [draftSave, understandDayId]);

  // Changes to the saved plan. Each one is saved on the server, which re-plans the unfinished tasks and answers with the new day.
  const busy = useRef(false);
  const todayIso = () => localClock(s.settings.timezone).date;
  const mutate = (op: DayEditBody["op"], toast: string, ms?: number) => {
    if (!s.dayId || busy.current) return;
    busy.current = true;
    closeSheet();
    dispatch({ type: "toast", text: "Re-planning the rest of your day.", ms: 30000 });
    postDayEdit(s.dayId, op)
      .then((view) => dispatch({ type: "mutated", view, toast, ms }))
      .catch((e) => dispatch({ type: "toast", text: e instanceof ApiError && e.status === 429 ? "That's today's limit for re-planning. Your plan is unchanged." : "I couldn't change that. Your plan is unchanged." }))
      .finally(() => { busy.current = false; });
  };
  const undoLast = () => {
    const before = s.undo;
    if (!s.dayId || !before || busy.current) { dispatch({ type: "toast", text: null }); return; }
    busy.current = true;
    const states = before.tasks.map((t) => {
      const move = before.moved.find((m) => m.taskId === t.id);
      return { ...t, status: move ? ("moved" as const) : before.done.includes(t.id) ? ("done" as const) : ("open" as const), movedTo: move?.to ?? null };
    });
    dispatch({ type: "toast", text: "Putting your plan back.", ms: 30000 });
    postDayUndo(s.dayId, before.version, states)
      .then((view) => dispatch({ type: "undone", view }))
      .catch(() => dispatch({ type: "toast", text: "I couldn't undo that. Your plan is as it is now." }))
      .finally(() => { busy.current = false; });
  };
  // Re-plan from the user's own words. The thinking screen plays while the server reads them and rebuilds the day; the plan stays as it is until it is back.
  const replanRun = useRef(0);
  const replanned = useRef<ReplanView | null>(null);
  const replanSaid = useRef("");
  const [replanReady, setReplanReady] = useState(false);
  const startReplan = (text: string) => {
    if (!s.dayId || busy.current) return;
    const run = ++replanRun.current;
    busy.current = true;
    replanned.current = null;
    replanSaid.current = text;
    setReplanReady(false);
    dispatch({ type: "think", kind: "replan" });
    postReplan(s.dayId, text)
      .then((view) => {
        if (run !== replanRun.current) return;
        replanned.current = view;
        setReplanReady(true);
      })
      .catch((e) => {
        if (run !== replanRun.current) return;
        dispatch({ type: "screen", screen: "plan" });
        dispatch({ type: "toast", text: e instanceof ApiError && e.status === 429 ? "That's today's limit for re-planning. Your plan is unchanged." : "I couldn't rebuild that. Your plan is unchanged." });
      })
      .finally(() => { if (run === replanRun.current) busy.current = false; });
  };
  const finishReplanThinking = useCallback(() => {
    const view = replanned.current;
    if (view) dispatch({ type: "replanned", view, said: replanSaid.current });
  }, []);
  const toggleDone = (taskId: string) => {
    const finishing = !s.done.includes(taskId);
    dispatch({ type: "toggleDone", taskId });
    patchTask(taskId, { status: finishing ? "done" : "open" }).catch(() => {
      dispatch({ type: "toggleDone", taskId });
      dispatch({ type: "toast", text: "I couldn't save that. It is back as it was." });
    });
  };
  const move = (taskId: string, target: string) => {
    const title = s.tasks.find((t) => t.id === taskId)?.title ?? "Task";
    const to = resolveMoveTarget(target, todayIso());
    mutate({ type: "move", taskId, to }, `${title} moved to ${/^\d/.test(target) ? fmtMoveDate(target) : target}`, 5000);
  };
  const saveEdit = (task: Task, p: Partial<Task>) => {
    const changed = Object.fromEntries(Object.entries(p).filter(([k, v]) => task[k as keyof Task] !== v)) as Partial<Task>;
    if (Object.keys(changed).length === 0) { closeSheet(); return; }
    mutate({ type: "edit", taskId: task.id, patch: changed }, "Saved and re-planned.");
  };

  const sheet = s.sheet;
  const editTask = sheet?.type === "edit" ? s.tasks.find((t) => t.id === sheet.taskId) : undefined;
  const moveTask = sheet?.type === "move" ? s.tasks.find((t) => t.id === sheet.taskId) : undefined;
  const openTasks = s.tasks.filter((t) => !s.done.includes(t.id) && !s.moved.some((m) => m.taskId === t.id));

  let screen;
  if (!booted) {
    screen = <BootSkeleton />;
  } else if (s.screen === "thinking") {
    const preview = s.thinking === "dump" ? [] : s.tasks;
    const { title, steps } = thinkingSteps(s.thinking, preview, countThings(s.text), s.mode, s.settings, toHHMM(now()));
    const ready = s.thinking === "dump" ? understandReady : s.thinking === "plan" ? planReady : replanReady;
    const onDone = s.thinking === "dump" ? finishDumpThinking : s.thinking === "plan" ? finishPlanThinking : finishReplanThinking;
    screen = <ThinkingScreen key={s.thinking} title={title} steps={steps} ready={ready} onDone={onDone} />;
  } else if (s.screen === "understand") {
    screen = (
      <UnderstandScreen
        tasks={s.tasks} questions={s.questions} groupings={s.groupings} mode={s.mode} presets={s.presets}
        onMode={(mode) => dispatch({ type: "mode", mode })}
        onAnswer={answer}
        onRemove={(taskId) => dispatch({ type: "removeTask", taskId, now: now() })}
        onWhere={(taskId, w: Where) => patch(taskId, { location: w })}
        onDuration={(taskId, min) => patch(taskId, min === null ? { durationSource: "estimated" } : { durationMin: min, durationSource: "user" })}
        onAdd={(task) => dispatch({ type: "addTask", task, now: now() })}
        onBuild={startPlan} onSaveForLater={saveForLater}
        onBack={() => dispatch({ type: "screen", screen: "dump" })}
        onSettings={openSettings} offline={offline}
      />
    );
  } else if (s.screen === "plan" && s.plan) {
    screen = (
      <PlanScreen
        plan={s.plan} tasks={s.tasks} done={s.done} moved={s.moved} expanded={s.expanded} replan={s.replan} mode={s.mode}
        plannedAt={s.plannedAt} entrance={s.entrance} offline={offline} settings={s.settings} presets={s.presets} today={today}
        onExpand={(taskId) => dispatch({ type: "expand", taskId })}
        onToggleDone={toggleDone}
        onEdit={(taskId) => dispatch({ type: "sheet", sheet: { type: "edit", taskId } })}
        onMove={(taskId) => dispatch({ type: "sheet", sheet: { type: "move", taskId } })}
        onBringBack={(taskId) => mutate({ type: "bringBack", taskId }, "Back in today's plan.")}
        onAdd={(task) => mutate({ type: "add", task }, `${task.title} added and re-planned.`)}
        onReplan={(mic) => { setMicOnOpen(mic); dispatch({ type: "sheet", sheet: { type: "replan" } }); }}
        onNewDump={() => dispatch({ type: "sheet", sheet: { type: "newdump" } })}
        onSettings={openSettings}
      />
    );
  } else {
    screen = (
      <DumpScreen
        text={s.text} onText={(text) => dispatch({ type: "text", text })}
        onSubmit={submitDump} onSettings={openSettings}
        onYours={() => dispatch({ type: "sheet", sheet: { type: "presets" } })}
        presets={s.presets} notice={notice?.text} onRetry={notice?.retry ? submitDump : undefined} name={name} offline={offline}
        carried={carried} onCarry={(title) => { dispatch({ type: "text", text: `${s.text.trim() ? `${s.text.trim()}\n` : ""}${title}` }); setTaken((t) => [...t, title]); }}
        draft={pendingDraft && s.text === "" ? pendingDraft : null} onContinueDraft={continueDraft} onDiscardDraft={() => setPendingDraft(null)}
        forDay={forDay} onForDay={setForDay} today={today} onBackToPlan={s.plan && s.dayId ? () => dispatch({ type: "screen", screen: "plan" }) : undefined}
        examples={demo ? EXAMPLES : undefined} onExample={(text) => dispatch({ type: "text", text })}
      />
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px]">
      {offline && <OfflineNote />}
      {screen}
      {editTask && (
        <EditSheet
          task={editTask} onClose={closeSheet}
          onSave={(p) => saveEdit(editTask, p)}
          onDelete={() => mutate({ type: "delete", taskId: editTask.id }, `${editTask.title} deleted.`)}
        />
      )}
      {moveTask && <MoveSheet title={moveTask.title} today={today} onClose={closeSheet} onPick={(to) => move(moveTask.id, to)} />}
      {s.sheet?.type === "replan" && (
        <ReplanSheet
          nowMin={now()} openTasks={openTasks} startWithMic={micOnOpen} onClose={closeSheet}
          onSubmit={(text) => { closeSheet(); startReplan(text); }}
        />
      )}
      {s.sheet?.type === "newdump" && <NewDumpSheet onClose={closeSheet} onConfirm={() => dispatch({ type: "newdump" })} />}
      {s.sheet?.type === "settings" && account !== "loading" && (
        <SettingsSheet loadFailed={account === "failed"} onRetry={retryLoad} settings={s.settings} presetCount={s.presets.length} onClose={closeSheet} onPresets={() => dispatch({ type: "sheet", sheet: { type: "presets" } })} onHistory={() => { closeSheet(); setHistoryOpen(true); }} onPassword={(has) => { setHasPassword(has); dispatch({ type: "sheet", sheet: { type: "password" } }); }} onSave={saveSettings} />
      )}
      {s.sheet?.type === "password" && <PasswordSheet hasPassword={hasPassword} onClose={() => dispatch({ type: "sheet", sheet: { type: "settings" } })} onDone={(text) => { dispatch({ type: "sheet", sheet: { type: "settings" } }); dispatch({ type: "toast", text }); }} />}
      {s.sheet?.type === "presets" && <PresetsSheet presets={s.presets} onAdd={addPreset} onRemove={removePreset} onClose={closeSheet} />}
      {historyOpen && <HistoryScreen today={localClock(s.settings.timezone).date} onClose={() => setHistoryOpen(false)} />}
      {s.toast && <Toast {...s.toast} onUndo={undoLast} onDone={() => dispatch({ type: "toast", text: null })} />}
    </div>
  );
}
