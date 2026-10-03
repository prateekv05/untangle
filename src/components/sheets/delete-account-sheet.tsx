"use client";

import { useState, type FormEvent } from "react";
import { signOutAction } from "@/app/welcome/actions";
import { Button } from "../button";
import { Sheet } from "../sheet";

/** Two steps: are you sure, then an optional reason. Deleting removes the account and every day, task, plan and setting with it. */
export function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"sure" | "reason">("sure");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/me", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}) });
      if (!res.ok) throw new Error();
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    try {
      await signOutAction();
      if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/welcome");
    }
  }

  if (step === "sure") {
    return (
      <Sheet title="Are you sure?" voice="This deletes your account and everything in it: your days, tasks, plans, presets and settings. It can't be undone." onClose={onClose}>
        <div className="flex flex-col gap-3">
          <Button variant="danger" className="min-h-[48px] w-full rounded-md border border-danger font-semibold no-underline" onClick={() => setStep("reason")}>Yes, delete my account</Button>
          <Button variant="secondary" onClick={onClose}>Keep my account</Button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title="Delete account" voice="Before you go, tell me why. You can skip this." onClose={onClose}>
      <form onSubmit={remove} className="flex flex-col gap-3">
        <label htmlFor="delete-reason" className="block text-[13px] font-medium leading-[18px] text-ink-muted">Reason for deleting (not mandatory)</label>
        <textarea id="delete-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={4} className="w-full resize-none rounded-md border border-line bg-surface-soft px-3.5 py-3 text-base" />
        {failed && <p role="alert" className="m-0 font-serif text-[17px] leading-[26px] text-ask-ink">I couldn&apos;t delete your account. Check your connection, then try again.</p>}
        <Button type="submit" variant="danger" className="min-h-[48px] w-full rounded-md border border-danger font-semibold no-underline" disabled={busy}>Delete my account</Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
      </form>
    </Sheet>
  );
}
