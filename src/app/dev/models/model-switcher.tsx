"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { TextField } from "@/components/text-field";

type Pair = { plan: string; fast: string };

export function ModelSwitcher({ allowlist, defaults, current }: { allowlist: string[]; defaults: Pair; current: Pair }) {
  const [key, setKey] = useState("");
  const [choice, setChoice] = useState<Pair>(current);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (reset: boolean) => {
    setMessage(null);
    const res = await fetch("/api/dev/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, plan: reset ? null : choice.plan, fast: reset ? null : choice.fast }),
    });
    if (reset) setChoice(defaults);
    setMessage(res.ok ? (reset ? "Back to the defaults." : "Saved for this device.") : res.status === 403 ? "That key is not right." : "I couldn't save that.");
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save(false); }}>
      {(["plan", "fast"] as const).map((role) => (
        <div key={role}>
          <label htmlFor={`m-${role}`} className="mb-1.5 block text-[13px] font-medium leading-[18px] text-ink-muted">
            {role === "plan" ? "Plan model" : "Fast model (understand, re-plan)"}
          </label>
          <select id={`m-${role}`} value={choice[role]} onChange={(e) => setChoice({ ...choice, [role]: e.target.value })} className="box-border min-h-12 w-full rounded-sm border border-line bg-surface px-3.5 text-base text-ink">
            {allowlist.map((m) => <option key={m} value={m}>{m}{m === defaults[role] ? " (default)" : ""}</option>)}
          </select>
        </div>
      ))}
      <TextField id="m-key" label="Switch key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
      <Button type="submit" disabled={!key}>Save for this device</Button>
      <Button variant="quiet" disabled={!key} onClick={() => void save(true)}>Use the defaults</Button>
      <p role="status" className="m-0 min-h-6 text-ink-muted">{message}</p>
    </form>
  );
}
