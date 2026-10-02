"use client";

import { useCallback, useEffect, useRef } from "react";
import { deleteDraft, putDraft, putDraftOnExit } from "./api-client";
import type { DraftPayload } from "./draft";

const NOTHING = "null";
const DEBOUNCE_MS = 1000;

/**
 * Autosaves the unfinished list: a second after the last change, and straight away when the page is hidden or closed.
 * `payload` null clears the saved draft, undefined leaves it alone. Failures are silent and retried on the next change.
 */
export function useDraftSave(payload: DraftPayload | null | undefined, enabled: boolean) {
  const key = payload === undefined ? undefined : JSON.stringify(payload);
  // What the server is believed to hold. Starts as "nothing"; `markExisting` says a draft was found when the app opened.
  const sent = useRef<string>(NOTHING);
  const latest = useRef({ payload, key, enabled });
  useEffect(() => { latest.current = { payload, key, enabled }; });

  const send = useCallback(async (): Promise<boolean> => {
    const { payload: p, key: k } = latest.current;
    if (k === undefined || p === undefined) return true;
    if (k === sent.current) return true;
    const before = sent.current;
    sent.current = k;
    try {
      if (p === null) await deleteDraft();
      else await putDraft(p);
      return true;
    } catch {
      sent.current = before; // not saved: try again on the next change
      return false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || key === undefined || key === sent.current) return;
    const timer = setTimeout(() => { void send(); }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, key, send]);

  useEffect(() => {
    const flush = () => {
      const { payload: p, key: k, enabled: on } = latest.current;
      if (!on || k === undefined || p === undefined || k === sent.current) return;
      sent.current = k;
      if (p === null) void deleteDraft().catch(() => {});
      else putDraftOnExit(p);
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", flush); };
  }, []);

  return {
    /** Save now. Resolves false when it could not be saved. */
    saveNow: send,
    /** A draft was found on the server when the app opened, so an empty list must clear it. */
    markExisting: useCallback(() => { sent.current = "existing"; }, []),
    /** The day was built: drop the draft and stop treating it as saved. */
    clear: useCallback(() => { sent.current = NOTHING; void deleteDraft().catch(() => {}); }, []),
  };
}
