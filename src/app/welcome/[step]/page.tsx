import { notFound, redirect } from "next/navigation";
import { OnboardingStep } from "@/components/onboarding-step";
import { GENDER_OPTIONS, isStep } from "@/lib/onboarding";
import { requireUser, UnauthorizedError } from "@/lib/session";

export const metadata = { title: "Untangle" };

export default async function OnboardingPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!isStep(step)) notFound();
  const user = await requireUser().catch((e) => {
    if (e instanceof UnauthorizedError) redirect("/welcome");
    throw e;
  });
  const gender = GENDER_OPTIONS.find((o) => o.value === user.gender)?.value ?? null;
  return <OnboardingStep step={step} initialName={user.name ?? ""} initialGender={gender} />;
}
