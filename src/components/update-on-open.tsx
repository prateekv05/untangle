"use client";

import { useEffect } from "react";

const FRESH_MS = 15_000;

/**
 * Keeps an installed app current. A home-screen app is often resumed rather than reloaded, so the browser may not look for
 * a new version for a day. This asks every time the app comes to the front, and when a new version takes over it reloads
 * once, but only right after the app opened so it never interrupts someone mid-task.
 */
export function UpdateOnOpen() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    let shownAt = Date.now();
    let reloading = false;
    const hadController = !!sw.controller; // the first install also takes control: that is not an update
    const onChange = () => {
      if (!hadController || reloading || Date.now() - shownAt > FRESH_MS) return;
      reloading = true;
      window.location.reload();
    };
    const check = () => { sw.getRegistration().then((r) => r?.update()).catch(() => {}); };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      shownAt = Date.now();
      check();
    };
    sw.addEventListener("controllerchange", onChange);
    document.addEventListener("visibilitychange", onVisible);
    check();
    return () => { sw.removeEventListener("controllerchange", onChange); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return null;
}
