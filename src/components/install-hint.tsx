"use client";

import { useInstall } from "@/lib/use-install";
import { Button } from "./button";
import { Icon } from "./icon";

/** Shown once a plan exists. Untangle speaks, so the body is the serif voice; the controls are plain. Gone for good once dismissed or installed. */
export function InstallHint() {
  const { hint, install, dismiss } = useInstall();
  if (!hint) return null;
  return (
    <section aria-label="Add to home screen" className="mx-5 mt-3.5 rounded-lg border border-line bg-surface p-4">
      <h2 className="m-0 mb-1 text-lg font-bold leading-6">Keep Untangle on your home screen</h2>
      {hint === "prompt" ? (
        <>
          <p className="voice-sm m-0 mb-3 text-ink-muted">It opens like an app, and today&apos;s plan opens even without a connection.</p>
          <div className="flex items-center gap-1">
            <div className="flex-1"><Button variant="secondary" onClick={install}>Add to home screen</Button></div>
            <Button variant="quiet" onClick={dismiss}>Not now</Button>
          </div>
        </>
      ) : (
        <>
          <ol className="voice-sm m-0 mb-1 list-decimal pl-5 text-ink-muted">
            <li>Tap <span className="inline-flex translate-y-[3px] text-ink"><Icon name="share" size={18} /></span><span className="sr-only">the Share button</span> in the browser bar.</li>
            <li>Choose Add to Home Screen.</li>
          </ol>
          <Button variant="quiet" onClick={dismiss}>Got it</Button>
        </>
      )}
    </section>
  );
}
