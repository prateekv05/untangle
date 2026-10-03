import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";
import { UntangleApp } from "@/components/untangle-app";
import { UnauthorizedError, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "Say everything on your mind, in any order. Untangle turns it into a realistic day, with a reason for every block, and rebuilds it when the day changes.",
  openGraph: { title: "Untangle", description: "A messy list in. A realistic day out.", images: ["/videos/untangle-teaser-poster.jpg"] },
};

export default async function Home() {
  // Signed in goes straight to the day. The proxy sends a half-onboarded account to onboarding first.
  // No session, or a cookie for an account that no longer exists, gets the landing page.
  const user = await requireUser().catch((e) => {
    if (e instanceof UnauthorizedError) return null;
    throw e;
  });
  return user ? <UntangleApp name={user.name} /> : <Landing />;
}
