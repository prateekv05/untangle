"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { ApiError, deletePreset, getPresets, getSettings, patchTask, postPlan, postPreset, postUnderstand, putSettings, type PlanResponse, type UnderstandResponse } from "@/lib/api-client";
import { APPOINTMENT_DUMP, EXAMPLE_DUMP } from "@/fixtures/example";
import { interpretReplan } from "@/fixtures/replan";
import { browserTimezone, nowMinutes } from "@/lib/clock";
import { initialState, reducer } from "@/lib/flow";
import { countThings } from "@/lib/guess";
import type { Preset } from "@/lib/guess";
import type { Question, Task } from "@/lib/schemas";
import { toHHMM } from "@/lib/time";
import type { Where } from "@/lib/where";
import { DumpScreen } from "./screens/dump-screen";
import { ListeningScreen } from "./screens/listening-screen";
import { PlanScreen } from "./screens/plan-screen";
import { ThinkingScreen, thinkingSteps } from "./screens/thinking-screen";
import { UnderstandScreen } from "./screens/understand-screen";
import { EditSheet } from "./sheets/edit-sheet";
import { MoveSheet } from "./sheets/move-sheet";
import { PasswordSheet } from "./sheets/password-sheet";
import { PresetsSheet } from "./sheets/presets-sheet";
import { ReplanSheet } from "./sheets/replan-sheet";
import { SettingsSheet } from "./sheets/settings-sheet";
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
  const [micOnOpen, setMicOnOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [hasPassword, setHasPassword] = useState(false);
  // Settings open only once the account's own values are in, so an early tap cannot save defaults over them.
  const [account, setAccount] = useState<"loading" | "ready" | "failed">("loading");
  // Carry-over needs a backend (Phase 6); in Phase 1 it only shows with ?carry=1 so the card can be seen.
  const carried = new URLSearchParams(search).get("carry") === "1" ? ["Gym", "Buy toothpaste"].filter((c) => !taken.includes(c)) : [];

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
    postUnderstand(text.trim())
      .then((res) => {
        if (run !== understandRun.current) return;
        understood.current = res;
        setUnderstandReady(true);
      })
      .catch((e) => {
        if (run !== understandRun.current) return;
        // The text stays in the box. Nothing here is a dead end: the user can try again straight away.
        setNotice(e instanceof ApiError && e.status === 429
          ? "That's today's limit for reading lists. Your text is saved. Try again tomorrow."
          : "I couldn't read that just now. Your text is saved. Try again.");
        dispatch({ type: "screen", screen: "dump" });
      });
  };
  const submitDump = () => {
    if (countThings(s.text) < 1) return;
    startUnderstand(s.text);
  };
  const finishDumpThinking = useCallback(() => {
    const res = understood.current;
    if (!res) return;
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
    const dayId = understood.current?.dayId;
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
    dispatch({ type: "planned", plan: res.plan, tasks: res.tasks, mode: res.mode, plannedAt: res.plannedAt });
  }, []);

  const sheet = s.sheet;
  const editTask = sheet?.type === "edit" ? s.tasks.find((t) => t.id === sheet.taskId) : undefined;
  const moveTask = sheet?.type === "move" ? s.tasks.find((t) => t.id === sheet.taskId) : undefined;
  const openTasks = s.tasks.filter((t) => !s.done.includes(t.id) && !s.moved.some((m) => m.taskId === t.id));

  let screen;
  if (s.screen === "listening") {
    screen = (
      <ListeningScreen
        onClose={() => dispatch({ type: "screen", screen: "dump" })}
        onDone={() => startUnderstand(`${s.text.trim() ? `${s.text.trim()}\n` : ""}${EXAMPLE_DUMP}.`)}
        onLimit={() => { startUnderstand(EXAMPLE_DUMP); dispatch({ type: "toast", text: "That's the limit. I'm working with what I heard." }); }}
        startAt={Number(new URLSearchParams(search).get("listen") ?? 0)}
      />
    );
  } else if (s.screen === "thinking") {
    const preview = s.thinking === "dump" ? [] : s.tasks;
    const { title, steps } = thinkingSteps(s.thinking, preview, countThings(s.text), s.mode, s.settings);
    screen = <ThinkingScreen key={s.thinking} title={title} steps={steps} ready={s.thinking === "dump" ? understandReady : planReady} onDone={s.thinking === "dump" ? finishDumpThinking : finishPlanThinking} />;
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
        onBuild={startPlan}
        onBack={() => dispatch({ type: "screen", screen: "dump" })}
        onSettings={openSettings}
      />
    );
  } else if (s.screen === "plan" && s.plan) {
    screen = (
      <PlanScreen
        plan={s.plan} tasks={s.tasks} done={s.done} moved={s.moved} expanded={s.expanded} replan={s.replan} mode={s.mode}
        plannedAt={s.plannedAt} entrance={s.entrance} settings={s.settings} presets={s.presets} today={today}
        onExpand={(taskId) => dispatch({ type: "expand", taskId })}
        onToggleDone={(taskId) => dispatch({ type: "toggleDone", taskId })}
        onEdit={(taskId) => dispatch({ type: "sheet", sheet: { type: "edit", taskId } })}
        onMove={(taskId) => dispatch({ type: "sheet", sheet: { type: "move", taskId } })}
        onBringBack={(taskId) => dispatch({ type: "bringBack", taskId, now: now() })}
        onAdd={(task) => dispatch({ type: "addTask", task, now: now() })}
        onReplan={(mic) => { setMicOnOpen(mic); dispatch({ type: "sheet", sheet: { type: "replan" } }); }}
        onSettings={openSettings}
      />
    );
  } else {
    screen = (
      <DumpScreen
        text={s.text} onText={(text) => dispatch({ type: "text", text })}
        onMic={() => dispatch({ type: "screen", screen: "listening" })}
        onSubmit={submitDump} onSettings={openSettings}
        onYours={() => dispatch({ type: "sheet", sheet: { type: "presets" } })}
        presets={s.presets} notice={notice} name={name}
        carried={carried} onCarry={(title) => { dispatch({ type: "text", text: `${s.text.trim() ? `${s.text.trim()}\n` : ""}${title}` }); setTaken((t) => [...t, title]); }}
        examples={demo ? EXAMPLES : undefined} onExample={(text) => dispatch({ type: "text", text })}
      />
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px]">
      {screen}
      {editTask && (
        <EditSheet
          task={editTask} onClose={closeSheet}
          onSave={(p) => { patch(editTask.id, p); closeSheet(); }}
          onDelete={() => dispatch({ type: "removeTask", taskId: editTask.id, now: now() })}
        />
      )}
      {moveTask && <MoveSheet title={moveTask.title} today={today} onClose={closeSheet} onPick={(to) => dispatch({ type: "moveLater", taskId: moveTask.id, to, now: now() })} />}
      {s.sheet?.type === "replan" && (
        <ReplanSheet
          nowMin={now()} openTasks={openTasks} startWithMic={micOnOpen} onClose={closeSheet}
          onSubmit={(text) => {
            const constraints = interpretReplan(text, openTasks, now());
            if (!constraints) { closeSheet(); dispatch({ type: "toast", text: "I couldn't rebuild that. Your plan is unchanged." }); return; }
            dispatch({ type: "applyReplan", constraints: { ...constraints, now: toHHMM(now()) }, said: text, now: now() });
          }}
        />
      )}
      {s.sheet?.type === "settings" && account !== "loading" && (
        <SettingsSheet loadFailed={account === "failed"} onRetry={retryLoad} settings={s.settings} presetCount={s.presets.length} onClose={closeSheet} onPresets={() => dispatch({ type: "sheet", sheet: { type: "presets" } })} onPassword={(has) => { setHasPassword(has); dispatch({ type: "sheet", sheet: { type: "password" } }); }} onSave={saveSettings} />
      )}
      {s.sheet?.type === "password" && <PasswordSheet hasPassword={hasPassword} onClose={() => dispatch({ type: "sheet", sheet: { type: "settings" } })} onDone={(text) => { dispatch({ type: "sheet", sheet: { type: "settings" } }); dispatch({ type: "toast", text }); }} />}
      {s.sheet?.type === "presets" && <PresetsSheet presets={s.presets} onAdd={addPreset} onRemove={removePreset} onClose={closeSheet} />}
      {s.toast && <Toast {...s.toast} onUndo={() => dispatch({ type: "undo" })} onDone={() => dispatch({ type: "toast", text: null })} />}
    </div>
  );
}
