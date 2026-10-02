import { cn } from "@/lib/cn";

const HEIGHTS = [18, 30, 22, 44, 58, 36, 64, 48, 26, 52, 70, 40, 28, 60, 46, 24, 56, 34, 66, 42, 20, 50, 38, 28, 16];

/** 25 bars. Pass `levels` (0 to 1 each) to follow the microphone; otherwise animated, and static under prefers-reduced-motion (see globals.css). */
export function Waveform({ active = true, levels, compact }: { active?: boolean; levels?: number[]; compact?: boolean }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center justify-center", compact ? "h-9 gap-[3px]" : "mt-[26px] h-[72px] gap-1")}>
      {HEIGHTS.map((h, i) => levels ? (
        <span key={i} className={cn("wave-live block rounded-[3px] bg-ink", compact ? "w-[3px]" : "w-[5px]")} style={{ height: compact ? 4 + Math.min(1, levels[i] ?? 0) * 30 : 8 + Math.min(1, levels[i] ?? 0) * 64 }} />
      ) : (
        <span key={i} className={cn("block rounded-[3px] bg-ink", compact ? "w-[3px]" : "w-[5px]", active && "wave-bar")} style={{ height: compact ? Math.round(h / 2) : h, animationDelay: `${(i * 0.07).toFixed(2)}s` }} />
      ))}
    </div>
  );
}
