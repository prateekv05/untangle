"use client";

import { Button } from "../button";
import { Sheet } from "../sheet";

/** A new dump is added to the day you pick; nothing already planned is thrown away. */
export function NewDumpSheet({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet title="Start a new dump" voice="Your plan stays as it is. I'll add what you tell me to the day you pick, and rebuild that day around it." onClose={onClose}>
      <div className="mt-2"><Button onClick={onConfirm}>Start a new dump</Button></div>
      <div className="mt-1.5 flex justify-center"><Button variant="quiet" onClick={onClose}>Not now</Button></div>
    </Sheet>
  );
}
