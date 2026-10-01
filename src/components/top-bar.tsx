import { Icon, Mark } from "./icon";

/** Mark + wordmark on the left, settings on the right. */
export function TopBar({ onSettings, hideSettings }: { onSettings?: () => void; hideSettings?: boolean }) {
  return (
    <header className="flex h-[58px] items-center justify-between px-5 pt-3.5">
      <div className="flex items-center gap-2 text-[19px] font-bold leading-6 tracking-[-0.01em]">
        <Mark />
        Untangle
      </div>
      {!hideSettings && (
        <button type="button" aria-label="Settings" onClick={onSettings} className="grid size-11 place-items-center rounded-sm text-ink-muted">
          <Icon name="settings" size={22} />
        </button>
      )}
    </header>
  );
}
