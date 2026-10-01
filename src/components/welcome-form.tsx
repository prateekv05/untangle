"use client";

import { useActionState, useEffect, useState } from "react";
import { signInWithGoogle, signInWithPassword } from "@/app/welcome/actions";
import { Button } from "./button";
import { GoogleMark } from "./google-mark";
import { Icon, Mark } from "./icon";
import { TextField } from "./text-field";

export function WelcomeForm({ googleFailed }: { googleFailed: boolean }) {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [state, action, pending] = useActionState(signInWithPassword, { failed: false, ok: false, email: "" });

  useEffect(() => {
    if (state.ok) window.location.assign("/");
  }, [state.ok]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-8 pt-24">
      <div>
        <div className="flex items-center gap-2.5 text-[28px] font-bold leading-8 tracking-[-0.01em]">
          <Mark size={36} />
          Untangle
        </div>
        <p className="mt-5 max-w-[300px] font-serif text-xl leading-[30px]">Turn a messy list into a realistic day.</p>
      </div>

      <div className="mt-auto">
        {open && (
          <form action={action} className="mb-4 flex flex-col gap-3">
            <TextField id="email" name="email" type="email" label="Email" autoComplete="email" defaultValue={state.email} required />
            <TextField
              id="password"
              name="password"
              type={show ? "text" : "password"}
              label="Password"
              autoComplete="current-password"
              required
              invalid={state.failed}
              trailing={
                <button type="button" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((v) => !v)} className="grid size-11 place-items-center text-ink-muted">
                  <Icon name={show ? "eyeOff" : "eye"} />
                </button>
              }
            />
            {state.failed && (
              <p role="alert" className="m-0 font-serif text-[17px] leading-[26px] text-ask-ink">That didn&apos;t match. You can also continue with Google.</p>
            )}
            <Button type="submit" disabled={pending}>Sign in</Button>
          </form>
        )}

        {googleFailed && !open && (
          <p role="alert" className="mb-3 mt-0 text-center font-serif text-[17px] leading-[26px] text-ask-ink">I couldn&apos;t sign you in. Try again.</p>
        )}
        <form action={signInWithGoogle}>
          <Button type="submit" variant="secondary" className="min-h-[52px] bg-surface text-base"><GoogleMark />Continue with Google</Button>
        </form>
        <p className="mx-1 mb-0 mt-3.5 text-center text-sm leading-5 text-ink-muted">Your days are saved to your account, so they follow you to any device.</p>
        <div className="mt-1 flex justify-center">
          <Button variant="quiet" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? "Hide password sign-in" : "Sign in with a password"}</Button>
        </div>
      </div>
    </main>
  );
}
