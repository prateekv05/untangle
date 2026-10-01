import { z } from "zod";

const modelId = z.string().regex(/^(anthropic|openai):[\w.\-]+$/, "must look like provider:model-id, e.g. anthropic:claude-sonnet-5-5");
const optionalSecret = z.string().optional().transform((v) => (v ? v : undefined));

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "is required"),
  TEST_DATABASE_URL: optionalSecret,
  ANTHROPIC_API_KEY: optionalSecret,
  OPENAI_API_KEY: optionalSecret,
  AI_MODEL_PLAN: modelId,
  AI_MODEL_FAST: modelId,
  AI_MODEL_ALLOWLIST: z
    .string()
    .min(1)
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(modelId).min(1)),
  MODEL_SWITCH_KEY: optionalSecret,
  STT_PROVIDER: z.enum(["webspeech", "openai"]).default("openai"),
  STT_MODEL: z.string().default("whisper-1"),
  DAILY_AI_CALL_LIMIT: z.coerce.number().int().positive().default(40),
  MAX_DUMP_CHARS: z.coerce.number().int().positive().default(4000),
  MAX_AUDIO_SECONDS: z.coerce.number().int().positive().default(120),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;
  const lines = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
  throw new Error(`Invalid environment. Fix these in .env.local (see .env.example):\n${lines.join("\n")}`);
}

let cached: Env | undefined;

// Lazy so `next build` and unit tests do not need secrets; call it where a value is first used.
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
