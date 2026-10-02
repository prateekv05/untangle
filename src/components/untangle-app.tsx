"use client";

import { useCallback, useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react";
import { deletePreset, getPresets, getSettings, postPreset, putSettings } from "@/lib/api-client";
import { APPOINTMENT_DUMP, EXAMPLE_DUMP, fixtureTasksFor } from "@/fixtures/example";
import { interpretReplan } from "@/fixtures/replan";
import { browserTimezone, nowMinutes } from "@/lib/clock";
import { initialState, reducer } from "@/lib/flow";
import { countThings, deriveQuestions, tasksFromText } from "@/lib/guess";
import type { Preset } from "@/lib/guess";
import type { Task } from "@/lib/schemas";
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
 * Every screen as one client state machine (src/lib/flow.ts). Understanding and planning still run on fixtures
 * until the AI phases; settings and presets are the signed-in account's own and are saved through /api.
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

  const submitDump = () => {
    if (countThings(s.text) < 1) return;
    setNotice(null);
    dispatch({ type: "think", kind: "dump" });
  };
  const finishDumpThinking = useCallback(() => {
    const tasks: Task[] = fixtureTasksFor(s.text) ?? tasksFromText(s.text, s.presets);
    const isWorkday = s.settings.workDays.includes(new Date().getDay());
    dispatch({ type: "understood", tasks, questions: deriveQuestions(tasks), mode: isWorkday ? "workday" : "dayoff" });
  }, [s.text, s.presets, s.settings.workDays]);
  const finishPlanThinking = useCallback(() => dispatch({ type: "build", now: now() }), [now]);

  const sheet = s.sheet;
  const editTask = sheet?.type === "edit" ? s.tasks.find((t) => t.id === sheet.taskId) : undefined;
  const moveTask = sheet?.type === "move" ? s.tasks.find((t) => t.id === sheet.taskId) : undefined;
  const openTasks = s.tasks.filter((t) => !s.done.includes(t.id) && !s.moved.some((m) => m.taskId === t.id));

  let screen;
  if (s.screen === "listening") {
    screen = (
      <ListeningScreen
        onClose={() => dispatch({ type: "screen", screen: "dump" })}
        onDone={() => { dispatch({ type: "text", text: `${s.text.trim() ? `${s.text.trim()}\n` : ""}${EXAMPLE_DUMP}.` }); dispatch({ type: "think", kind: "dump" }); }}
        onLimit={() => { dispatch({ type: "text", text: EXAMPLE_DUMP }); dispatch({ type: "think", kind: "dump" }); dispatch({ type: "toast", text: "That's the limit. I'm working with what I heard." }); }}
        startAt={Number(new URLSearchParams(search).get("listen") ?? 0)}
      />
    );
  } else if (s.screen === "thinking") {
    const preview = s.thinking === "dump" ? [] : s.tasks;
    const { title, steps } = thinkingSteps(s.thinking, preview, countThings(s.text), s.mode, s.settings);
    screen = <ThinkingScreen key={s.thinking} title={title} steps={steps} onDone={s.thinking === "dump" ? finishDumpThinking : finishPlanThinking} />;
  } else if (s.screen === "understand") {
    screen = (
      <UnderstandScreen
        tasks={s.tasks} questions={s.questions} mode={s.mode} presets={s.presets}
        onMode={(mode) => dispatch({ type: "mode", mode })}
        onAnswer={(question, value) => dispatch({ type: "answer", question, value })}
        onRemove={(taskId) => dispatch({ type: "removeTask", taskId, now: now() })}
        onWhere={(taskId, w: Where) => dispatch({ type: "patchTask", taskId, patch: { location: w }, now: now() })}
        onDuration={(taskId, min) => dispatch({ type: "patchTask", taskId, patch: min === null ? { durationSource: "estimated" } : { durationMin: min, durationSource: "user" }, now: now() })}
        onAdd={(task) => dispatch({ type: "addTask", task, now: now() })}
        onBuild={() => dispatch({ type: "think", kind: "plan" })}
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
          onSave={(patch) => { dispatch({ type: "patchTask", taskId: editTask.id, patch, now: now() }); closeSheet(); }}
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
