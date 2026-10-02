"use client";

import { useEffect } from "react";

/** Confirms an action in the same words as its button. role=status so it is announced. Auto-dismisses. */
export function Toast({ id, text, undo, ms, onUndo, onDone, preview }: { id: number; text: string; undo: boolean; ms: number; onUndo: () => void; onDone: () => void; preview?: boolean }) {
  useEffect(() => {
    if (preview) return;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ms]);
  return (
    <div className={preview ? "px-4" : "pointer-events-none fixed inset-x-0 top-4 z-50 mx-auto max-w-[430px] px-4"}>
      <div role="status" className="toast-in pointer-events-auto flex min-h-[52px] items-center justify-between gap-3 rounded-md bg-ink px-4 text-sm text-ink-inverse shadow-lift">
        <span>{text}</span>
        {undo && (
          <button type="button" onClick={onUndo} className="min-h-11 min-w-11 px-1 font-semibold underline">Undo</button>
        )}
      </div>
    </div>
  );
}
