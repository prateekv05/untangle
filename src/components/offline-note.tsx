/** Shown on every screen while offline. The disabled controls point here, so it says why. */
export function OfflineNote() {
  return (
    <p role="status" className="voice-sm m-0 mx-5 mt-1 rounded-sm bg-surface-soft px-3 py-[9px] text-ink-muted">
      You&apos;re offline. You can read your plan, but changes need a connection.
    </p>
  );
}
