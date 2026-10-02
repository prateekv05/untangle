"use client";

import { useId, useState } from "react";
import { Chip } from "./chip";

const MIN = 5;
const MAX = 480;
const box = "min-h-11 w-[64px] rounded-pill border border-line bg-surface px-3 text-center text-sm font-medium";

/** Free duration entry that sits next to the duration chips: hours and minutes, 5 min to 8 h in total. */
export function MinutesInput({ onSet, small }: { onSet: (min: number) => void; small?: boolean }) {
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const id = useId();
  const total = Number(h || 0) * 60 + Number(m || 0);
  const valid = (h !== "" || m !== "") && total >= MIN && total <= MAX;
  const submit = () => { if (valid) { onSet(total); setH(""); setM(""); } };
  const field = (value: string, set: (v: string) => void, label: string, placeholder: string, max: number) => (
    <>
      <label htmlFor={`${id}-${placeholder}`} className="sr-only">{label}</label>
      <input
        id={`${id}-${placeholder}`}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={placeholder}
        maxLength={max}
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        className={box}
      />
    </>
  );
  return (
    <div className="flex items-center gap-2">
      {field(h, setH, "Hours", "hr", 1)}
      {field(m, setM, "Minutes", "min", 3)}
      <Chip small={small} disabled={!valid} onClick={submit}>Set</Chip>
    </div>
  );
}
