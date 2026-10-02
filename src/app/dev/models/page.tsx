import { notFound } from "next/navigation";
import { OVERRIDE_COOKIE, parseOverride, resolveModelSpec, configFromEnv } from "@/lib/ai/models";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { ModelSwitcher } from "./model-switcher";

/** Live model testing. Hidden (404) when MODEL_SWITCH_KEY is empty. Needs a signed-in user: the proxy enforces it. */
export default async function ModelsPage() {
  const env = getEnv();
  if (!env.MODEL_SWITCH_KEY) notFound();
  const config = configFromEnv(env);
  const override = parseOverride((await cookies()).get(OVERRIDE_COOKIE)?.value);
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] px-5 pb-10 pt-8">
      <h1 className="m-0 text-[32px] font-bold leading-9 tracking-[-0.02em]">Models</h1>
      <p className="mb-6 mt-2 text-ink-muted">Changes apply to this device only. Everyone else keeps the defaults.</p>
      <ModelSwitcher
        allowlist={env.AI_MODEL_ALLOWLIST}
        defaults={config.defaults}
        current={{ plan: resolveModelSpec("plan", config, override).spec, fast: resolveModelSpec("fast", config, override).spec }}
      />
    </main>
  );
}
