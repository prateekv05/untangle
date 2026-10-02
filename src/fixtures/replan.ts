/**
 * Quick chips for the re-plan sheet: each fills the text box with a sentence the model then reads (src/lib/ai/replan.ts).
 */
/** Chip sentences. Chips that need a target are completed with the picked task or amount. */
export const REPLAN_CHIPS: { id: string; label: string; needs: "task" | "delay" | null; voice?: string; sentence: (x: string) => string }[] = [
  { id: "unfinished", label: "I didn't finish something", needs: "task", voice: "Pick the one you didn't finish.", sentence: (x: string) => `I didn't finish ${x}.` },
  { id: "late", label: "Running late", needs: "delay", sentence: (x: string) => `I'm running ${x} late.` },
  { id: "light", label: "Lighter afternoon", needs: null, sentence: () => "Make it a lighter afternoon." },
  { id: "three", label: "Only 3 hours left", needs: null, sentence: () => "I only have 3 hours left." },
  { id: "must", label: "I must finish something", needs: "task", voice: "Pick the one that has to get done today.", sentence: (x: string) => `I must finish ${x} today.` },
];
export const DELAY_OPTIONS = ["30 minutes", "1 hour", "90 minutes", "2 hours"];
