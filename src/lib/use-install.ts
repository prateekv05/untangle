"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { installHint, isIos, type InstallHint } from "./install";

const KEY = "untangle-install-dismissed";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const readDismissed = (): boolean => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; } // blocked storage: show the hint, it only costs a tap
};

const noop = () => () => {};
const standalone = () => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** The install hint to show now, how to act on it, and how to dismiss it for good. */
export function useInstall(): { hint: InstallHint; install: () => void; dismiss: () => void } {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [dismissedNow, setDismissedNow] = useState(false);
  const stored = useSyncExternalStore(noop, readDismissed, () => true); // hidden on the server, so it never flashes
  const dismissed = stored || dismissedNow;
  const installed = useSyncExternalStore(noop, standalone, () => true);
  const ios = useSyncExternalStore(noop, () => isIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints), () => false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as PromptEvent); };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissedNow(true);
    try { localStorage.setItem(KEY, "1"); } catch { /* the hint stays hidden for this visit */ }
  }, []);
  const install = useCallback(() => {
    if (!prompt) return;
    void prompt.prompt();
    void prompt.userChoice.then(() => setPrompt(null)); // the browser shows its own dialog, and accepts or declines only once
  }, [prompt]);

  return { hint: installHint({ standalone: installed, ios, canPrompt: prompt !== null, dismissed }), install, dismiss };
}
