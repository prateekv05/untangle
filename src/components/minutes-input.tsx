"use client";

import { useId, useState } from "react";
import { Chip } from "./chip";

const MIN = 5;
const MAX = 480;

/** Free minutes entry that sits next to the duration chips. Accepts whole minutes from 5 to 480. */
export function MinutesInput({ onSet, small }: { onSet: (min: number) => void; small?: boolean }) {
  const [v, setV] = useState("");
  const id = useId();
  const n = Number(v);
  const valid = v !== "" && Number.isInteger(n) && n >= MIN && n <= MAX;
  const submit = () => { if (valid) { onSet(n); setV(""); } };
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">Minutes</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="min"
        maxLength={3}
        value={v}
        onChange={(e) => setV(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        className="min-h-11 w-[72px] rounded-pill border border-line bg-surface px-3.5 text-center text-sm font-medium"
      />
      <Chip small={small} disabled={!valid} onClick={submit}>Set</Chip>
    </div>
  );
}
