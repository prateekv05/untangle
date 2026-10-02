import { cn } from "@/lib/cn";

const HEIGHTS = [18, 30, 22, 44, 58, 36, 64, 48, 26, 52, 70, 40, 28, 60, 46, 24, 56, 34, 66, 42, 20, 50, 38, 28, 16];

/** 25 bars. Pass `levels` (0 to 1 each) to follow the microphone; otherwise animated, and static under prefers-reduced-motion (see globals.css). */
export function Waveform({ active = true, levels }: { active?: boolean; levels?: number[] }) {
  return (
    <div aria-hidden="true" className="mt-[26px] flex h-[72px] items-center justify-center gap-1">
      {HEIGHTS.map((h, i) => levels ? (
        <span key={i} className="wave-live block w-[5px] rounded-[3px] bg-ink" style={{ height: 8 + Math.min(1, levels[i] ?? 0) * 64 }} />
      ) : (
        <span key={i} className={cn("block w-[5px] rounded-[3px] bg-ink", active && "wave-bar")} style={{ height: h, animationDelay: `${(i * 0.07).toFixed(2)}s` }} />
      ))}
    </div>
  );
}
