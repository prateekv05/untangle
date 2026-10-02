import { TopBar } from "./top-bar";

/** Stands in for the first screen while today's saved day loads. It fades in after 300 ms, so a quick load never flashes it. */
export function BootSkeleton() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Loading your day">
      <div className="late">
        <TopBar hideSettings />
        <div className="px-5 pt-[22px]">
          <div className="h-8 w-3/4 rounded-sm bg-surface-soft" />
          <div className="mt-3 h-5 w-1/2 rounded-sm bg-surface-soft" />
          <div className="mt-[18px] h-[200px] rounded-lg bg-surface-soft" />
          <div className="mt-4 h-[96px] rounded-md bg-surface-soft" />
          <div className="mt-3 h-[96px] rounded-md bg-surface-soft" />
        </div>
      </div>
    </div>
  );
}
