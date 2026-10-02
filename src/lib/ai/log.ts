/** The one place AI calls are logged: route, role, model, latency, tokens. Never the prompt, the text or an error message. */
export type AiLog = {
  route: string;
  role: "fast" | "plan";
  model: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  /** Error class name only (messages can carry the user's text). */
  error?: string;
  /** Plan pipeline only. */
  source?: "llm" | "fallback";
  repaired?: boolean;
  /** Validator messages (they name task titles, never the dump). */
  validatorErrors?: string[];
};

export const logAiCall = (entry: AiLog): void => console.log(JSON.stringify(entry));
