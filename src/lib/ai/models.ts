/**
 * The only file that knows about AI providers. Call sites ask for a role ("plan" or "fast") and get a model;
 * they never name one. Models are written `provider:model-id`, defaults come from env, and a per-user override
 * (set from /dev/models) can only pick something from AI_MODEL_ALLOWLIST.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { z } from "zod";

export const ROLES = ["plan", "fast"] as const;
export type Role = (typeof ROLES)[number];
export type Provider = "anthropic" | "openai";
export type ModelRef = { provider: Provider; id: string; spec: string };

/** The cookie that holds one device's model choices. Validated against the allowlist on every read. */
export const OVERRIDE_COOKIE = "untangle_models";

export class ModelConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelConfigError";
  }
}

export function parseModelSpec(spec: string): ModelRef {
  const match = /^(anthropic|openai):([\w.\-]+)$/.exec(spec.trim());
  if (!match) throw new ModelConfigError(`Model must look like provider:model-id, got "${spec}"`);
  const provider = match[1] as Provider;
  return { provider, id: match[2], spec: `${provider}:${match[2]}` };
}

const Override = z.object({ plan: z.string().optional(), fast: z.string().optional() });
export type ModelOverride = z.infer<typeof Override>;

/** Reads the override cookie value. Anything malformed means "no override", never an error. */
export function parseOverride(raw: string | undefined | null): ModelOverride {
  if (!raw) return {};
  try {
    const parsed = Override.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export const serializeOverride = (o: ModelOverride): string => JSON.stringify(o);

export type ModelConfig = { defaults: Record<Role, string>; allowlist: string[] };

/** The override wins only when it is on the allowlist; otherwise the default is used. The default is never filtered. */
export function resolveModelSpec(role: Role, config: ModelConfig, override: ModelOverride = {}): ModelRef {
  const wanted = override[role];
  if (wanted) {
    try {
      const ref = parseModelSpec(wanted);
      if (config.allowlist.includes(ref.spec)) return ref;
    } catch {
      // fall through to the default
    }
  }
  return parseModelSpec(config.defaults[role]);
}

/** Models that reject `temperature` (the SDK would warn on every call). Provider quirks live here, never in prompts. */
const NO_TEMPERATURE = [/^claude-(sonnet|opus|fable)-5/, /^gpt-6/];
export const callSettings = (ref: ModelRef): { temperature?: number } => (NO_TEMPERATURE.some((re) => re.test(ref.id)) ? {} : { temperature: 0 });

export function buildModel(ref: ModelRef): LanguageModel {
  // Keys come from ANTHROPIC_API_KEY / OPENAI_API_KEY in the server environment; they never reach the client.
  return ref.provider === "anthropic" ? createAnthropic()(ref.id) : createOpenAI()(ref.id);
}

export function configFromEnv(env: { AI_MODEL_PLAN: string; AI_MODEL_FAST: string; AI_MODEL_ALLOWLIST: string[] }): ModelConfig {
  return { defaults: { plan: env.AI_MODEL_PLAN, fast: env.AI_MODEL_FAST }, allowlist: env.AI_MODEL_ALLOWLIST };
}

export async function getModel(role: Role, override: ModelOverride = {}): Promise<{ ref: ModelRef; model: LanguageModel }> {
  const { getEnv } = await import("../env"); // lazy: unit tests of this file need no env
  const ref = resolveModelSpec(role, configFromEnv(getEnv()), override);
  return { ref, model: buildModel(ref) };
}
