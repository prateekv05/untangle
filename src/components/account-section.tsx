"use client";

import { useEffect, useState } from "react";
import { signOutAction } from "@/app/welcome/actions";
import { Button } from "./button";
import { TextField } from "./text-field";

type Me = { email: string; name: string | null; hasPassword: boolean };

/** Account row of the Settings sheet: editable name, email, optional password. Sign out and delete live at the foot of the sheet (AccountActions). */
export function AccountSection({ onPassword }: { onPassword: (hasPassword: boolean) => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [nameFailed, setNameFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/me")
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
      .then((m) => {
        if (!live || !m) return;
        setMe(m);
        setName(m.name ?? "");
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  async function saveName() {
    const next = name.trim();
    if (!me || next === (me.name ?? "")) return;
    if (!next) { setName(me.name ?? ""); return; }
    try {
      const res = await fetch("/api/me", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: next }) });
      if (!res.ok) throw new Error();
      setMe({ ...me, name: next });
      setNameFailed(false);
    } catch {
      setNameFailed(true);
    }
  }

  if (!me) return <div className="mb-5 min-h-[88px]" aria-busy="true" />;
  const row = "flex min-h-[52px] w-full items-center justify-between rounded-md bg-surface-soft px-4 text-left font-semibold";
  return (
    <section aria-label="Account" className="mb-5">
      <TextField id="account-name" label="Name" value={name} maxLength={40} autoComplete="given-name" onChange={(e) => setName(e.target.value)} onBlur={saveName} />
      {nameFailed && <p role="alert" className="mb-0 mt-2 font-serif text-[17px] leading-[26px] text-ask-ink">I couldn&apos;t save your name. Try again.</p>}
      <p className="mb-3 mt-2 text-sm leading-5 text-ink-muted">{me.email}</p>
      <button type="button" onClick={() => onPassword(me.hasPassword)} className={row}>
        Password <span className="font-medium text-ink-muted">{me.hasPassword ? "Change or remove" : "Not set"}</span>
      </button>
      {!me.hasPassword && <p className="voice-sm m-0 mt-2 text-ink-muted">Optional. You can always sign in with Google.</p>}
    </section>
  );
}

/** Sign out and delete account, at the very bottom of the Settings sheet. */
export function AccountActions({ onDelete }: { onDelete: () => void }) {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await signOutAction();
      // The service worker keeps the last plan for offline reading: drop it so the next person on this phone cannot open it.
      if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    } finally {
      // Full load so the proxy sees the cleared session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/welcome");
    }
  }

  return (
    <section aria-label="Sign out or delete account" className="mt-6 flex flex-col items-center">
      <Button variant="quiet" onClick={signOut} disabled={signingOut}>Sign out</Button>
      <Button variant="danger" onClick={onDelete} disabled={signingOut}>Delete account</Button>
    </section>
  );
}
