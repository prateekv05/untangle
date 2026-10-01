"use client";

import { useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import { Button } from "../button";
import { Icon } from "../icon";
import { Sheet } from "../sheet";
import { TextField } from "../text-field";

/** Optional password for the same account. Set, change or remove; Google sign-in keeps working either way. */
export function PasswordSheet({ hasPassword, onClose, onDone }: { hasPassword: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const tooShort = value.length < MIN_PASSWORD_LENGTH;

  async function call(method: "PUT" | "DELETE", done: string) {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/me/password", { method, headers: { "content-type": "application/json" }, body: method === "PUT" ? JSON.stringify({ password: value }) : undefined });
      if (!res.ok) throw new Error();
      onDone(done);
    } catch {
      setBusy(false);
      setFailed(true);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!tooShort && !busy) void call("PUT", hasPassword ? "Password changed" : "Password set");
  }

  return (
    <Sheet title={hasPassword ? "Change password" : "Set a password"} voice="Optional. You can always sign in with Google." onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <TextField
          id="new-password"
          label="New password"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="new-password"
          autoFocus
          maxLength={200}
          trailing={
            <button type="button" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((v) => !v)} className="grid size-11 place-items-center text-ink-muted">
              <Icon name={show ? "eyeOff" : "eye"} />
            </button>
          }
        />
        <p className="m-0 text-sm leading-5 text-ink-muted">{`At least ${MIN_PASSWORD_LENGTH} characters.`}</p>
        {failed && <p role="alert" className="m-0 font-serif text-[17px] leading-[26px] text-ask-ink">I couldn&apos;t save that. Try again.</p>}
        <Button type="submit" disabled={tooShort || busy}>{hasPassword ? "Change password" : "Set password"}</Button>
        {hasPassword && (
          <div className="flex justify-center">
            <Button variant="danger" disabled={busy} onClick={() => void call("DELETE", "Password removed")}>Remove password</Button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
