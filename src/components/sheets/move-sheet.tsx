"use client";

import { useState } from "react";
import { moveTargets } from "@/lib/flow";
import { Button } from "../button";
import { Sheet, SheetOption } from "../sheet";

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function MoveSheet({ title, today, onPick, onClose }: { title: string; today: Date; onPick: (label: string) => void; onClose: () => void }) {
  const [date, setDate] = useState("");
  const min = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);
  return (
    <Sheet title="Move to a later day" voice={`${title} leaves today's plan. You can bring it back.`} onClose={onClose}>
      {moveTargets(today).map((t) => <SheetOption key={t} onClick={() => onPick(t)}>{t}</SheetOption>)}
      <label htmlFor="move-date" className="mb-1.5 mt-3.5 block text-[13px] font-medium leading-[18px] text-ink-muted">Or pick a date</label>
      <div className="flex gap-2">
        <input id="move-date" type="date" min={min} value={date} onChange={(e) => setDate(e.target.value)} className="min-h-11 flex-1 rounded-md border border-line bg-surface-soft px-3.5 text-base" />
        <Button variant="secondary" className="!w-auto px-5" disabled={!date} onClick={() => onPick(fmtDate(date))}>Move</Button>
      </div>
    </Sheet>
  );
}
