export const STEPS = ["name", "gender", "dump", "plan", "replan"] as const;
export type Step = (typeof STEPS)[number];

export const isStep = (v: string): v is Step => (STEPS as readonly string[]).includes(v);
export const stepNumber = (s: Step) => STEPS.indexOf(s) + 1;
export const prevStep = (s: Step): Step | null => STEPS[STEPS.indexOf(s) - 1] ?? null;
export const nextStep = (s: Step): Step | null => STEPS[STEPS.indexOf(s) + 1] ?? null;
export const isExplainer = (s: Step) => s === "dump" || s === "plan" || s === "replan";

export const GENDER_OPTIONS = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;
