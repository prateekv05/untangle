/** Prompts live in prompts/*.md and are baked in at build time (scripts/gen-prompts.mjs). */
import { PROMPTS } from "./prompts.generated";

export type PromptName = keyof typeof PROMPTS;
export const loadPrompt = (name: PromptName): string => PROMPTS[name];
