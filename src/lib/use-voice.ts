"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createTranscriber } from "./stt";
import { VoiceError, type Transcriber, type VoiceErrorCode } from "./stt/types";

export type VoicePhase = "ask" | "starting" | "listening" | "processing" | "error" | "done" | "idle";
export const BARS = 25;
const FLAT = Array<number>(BARS).fill(0);

/** Where the browser says the microphone permission stands. "unknown" where it cannot be asked (Safari). */
async function micPermission(): Promise<"granted" | "prompt" | "denied" | "unknown"> {
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

/**
 * One dictation session: permission, listening, live text, level history for the waveform, a timer with an auto-stop,
 * and finish() that resolves with the final transcript. Nothing is stored; leaving the screen cancels.
 * The caller decides what to do with the text (Dump sends it to understand, Re-plan puts it in the box).
 */
export function useVoice({ maxSeconds, onLimit }: { maxSeconds: number; onLimit?: (text: string) => void }) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [text, setText] = useState("");
  const [levels, setLevels] = useState<number[]>(FLAT);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<VoiceErrorCode | null>(null);
  const transcriber = useRef<Transcriber | null>(null);
  const alive = useRef(true);
  const heard = useRef("");
  const busy = useRef(false);

  const fail = useCallback((e: unknown) => {
    transcriber.current = null;
    setError(e instanceof VoiceError ? e.code : "failed");
    setPhase("error");
  }, []);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPhase("starting");
    setError(null);
    setText("");
    setSeconds(0);
    setLevels(FLAT);
    heard.current = "";
    const t = createTranscriber();
    if (!t) { busy.current = false; fail(new VoiceError("unsupported")); return; }
    try {
      await t.start((partial) => { heard.current = partial; if (alive.current) setText(partial); }, (l) => setLevels((prev) => [...prev.slice(1), l]));
      if (!alive.current) { t.cancel(); return; }
      transcriber.current = t;
      setPhase("listening");
    } catch (e) {
      t.cancel();
      if (alive.current) fail(e);
    } finally {
      busy.current = false;
    }
  }, [fail]);

  /** Checks the permission first so a first-time user sees the explainer before the browser's own prompt. */
  const begin = useCallback(async () => {
    const state = await micPermission();
    if (!alive.current) return;
    if (state === "denied") fail(new VoiceError("denied"));
    else if (state === "prompt") setPhase("ask");
    else await start();
  }, [fail, start]);

  const finish = useCallback(async (): Promise<string | null> => {
    const t = transcriber.current;
    if (!t) return null;
    transcriber.current = null;
    setPhase("processing");
    try {
      const final = await t.stop();
      if (alive.current) setPhase("done");
      return final;
    } catch (e) {
      if (alive.current) fail(e);
      return null;
    }
  }, [fail]);

  const cancel = useCallback(() => {
    transcriber.current?.cancel();
    transcriber.current = null;
  }, []);

  /** Back to idle: closes the permission explainer or clears an error so the user can type. */
  const reset = useCallback(() => {
    cancel();
    setError(null);
    setPhase("idle");
  }, [cancel]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; transcriber.current?.cancel(); transcriber.current = null; };
  }, []);

  const limitRef = useRef(onLimit);
  useEffect(() => { limitRef.current = onLimit; });
  useEffect(() => {
    if (phase !== "listening") return;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 1;
      setSeconds(elapsed);
      if (elapsed < maxSeconds) return;
      clearInterval(timer);
      void finish().then((final) => { if (final && alive.current) limitRef.current?.(final); });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, maxSeconds, finish]);

  return { phase, text, levels, seconds, error, begin, start, finish, cancel, reset };
}
