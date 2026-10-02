"use client";

import { Button } from "../button";
import { Sheet } from "../sheet";

/** Starting over replaces today's plan once the new list is read, so it asks first. */
export function NewDumpSheet({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet title="Start a new dump" voice="Today's plan is replaced as soon as I've read your new list. Until then it stays saved." onClose={onClose}>
      <div className="mt-2"><Button onClick={onConfirm}>Start a new dump</Button></div>
      <div className="mt-1.5 flex justify-center"><Button variant="quiet" onClick={onClose}>Keep my plan</Button></div>
    </Sheet>
  );
}
