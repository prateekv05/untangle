"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import { GENDER_OPTIONS, isExplainer, nextStep, prevStep, stepNumber, STEPS, type Step } from "@/lib/onboarding";
import { Button } from "./button";
import { Icon } from "./icon";
import { DumpArt, PlanArt, ReplanArt } from "./onboarding-art";
import { TextField } from "./text-field";

type Gender = (typeof GENDER_OPTIONS)[number]["value"];

const COPY: Record<Step, { title: string; sub?: string; voice?: string }> = {
  name: { title: "What should I call you?", sub: "Just a first name is fine." },
  gender: { title: "How do you identify?", sub: "Optional. I don't use this to plan your day." },
  dump: { title: "Say everything on your mind.", voice: "Talk or type it in any order. I'll sort out what it is and what belongs together." },
  plan: { title: "Get a day you can actually do.", voice: "Every choice comes with a reason, and I only ask when the answer changes your plan." },
  replan: { title: "When life changes, just say so.", voice: "Tell me in plain words and I'll rebuild the rest of your day. Finished things stay put." },
};

async function saveMe(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/me", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

export function OnboardingStep({ step, initialName, initialGender }: { step: Step; initialName: string; initialGender: Gender | null }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [gender, setGender] = useState<Gender | null>(initialGender);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const back = prevStep(step);
  const next = nextStep(step);
  const last = next === null;
  const copy = COPY[step];
  const canContinue = step !== "name" || name.trim().length > 0;

  async function finish() {
    // Skip on an explainer also finishes: the name was saved on step 1.
    const ok = await saveMe({ complete: true });
    if (!ok) return fail();
    router.replace("/");
    router.refresh();
  }

  function fail() {
    setBusy(false);
    setFailed(true);
  }

  async function onContinue(e?: FormEvent) {
    e?.preventDefault();
    if (!canContinue || busy) return;
    setBusy(true);
    setFailed(false);
    if (step === "name" && !(await saveMe({ name: name.trim() }))) return fail();
    if (step === "gender" && !(await saveMe({ gender }))) return fail();
    if (last) return finish();
    router.push(`/welcome/${next}`);
    setBusy(false);
  }

  return (
    <form onSubmit={onContinue} className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6 pb-8">
      <div className="flex h-[58px] items-center justify-between pt-3.5">
        <div className="w-[72px]">
          {back && (
            <button type="button" aria-label="Back" onClick={() => router.push(`/welcome/${back}`)} className="grid size-11 place-items-center rounded-sm text-ink">
              <Icon name="back" size={22} />
            </button>
          )}
        </div>
        <div role="img" aria-label={`Step ${stepNumber(step)} of ${STEPS.length}`} className="flex gap-2">
          {STEPS.map((s, i) => (
            <span key={s} className={cn("h-2 rounded-pill", i + 1 === stepNumber(step) ? "w-5" : "w-2", i < stepNumber(step) ? "bg-ink" : "bg-line")} />
          ))}
        </div>
        <div className="w-[72px] text-right">
          {isExplainer(step) && !last && (
            <Button variant="quiet" onClick={finish} disabled={busy}>Skip</Button>
          )}
        </div>
      </div>

      <div className="pt-7">
        {step === "dump" && <DumpArt />}
        {step === "plan" && <PlanArt />}
        {step === "replan" && <ReplanArt />}

        <h1 className="m-0 text-[32px] font-bold leading-9 tracking-[-0.02em]">{copy.title}</h1>
        {copy.sub && <p className="mb-0 mt-2.5 text-base leading-6 text-ink-muted">{copy.sub}</p>}
        {copy.voice && <p className="mb-0 mt-3.5 font-serif text-xl leading-[30px]">{copy.voice}</p>}

        {step === "name" && (
          <div className="mt-7">
            <TextField id="name" label="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" autoFocus enterKeyHint="next" className="min-h-[52px] text-lg" />
          </div>
        )}

        {step === "gender" && (
          <div role="radiogroup" aria-label="How do you identify" className="mt-7 flex flex-col gap-2.5">
            {GENDER_OPTIONS.map((o) => {
              const on = gender === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setGender(on ? null : o.value)}
                  className={cn("flex min-h-[52px] w-full items-center justify-between rounded-md border px-4 text-left text-base leading-6 text-ink", on ? "border-ink bg-surface-soft font-semibold" : "border-line bg-surface font-medium")}
                >
                  {o.label}
                  {on && <Icon name="check" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-auto pt-6">
        {failed && <p role="alert" className="mb-3 mt-0 text-center font-serif text-[17px] leading-[26px] text-ask-ink">I couldn&apos;t save that. Try again.</p>}
        <Button type="submit" disabled={!canContinue || busy}>{last ? "Start" : "Continue"}</Button>
      </div>
    </form>
  );
}
