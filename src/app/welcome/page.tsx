import { WelcomeForm } from "@/components/welcome-form";

export const metadata = { title: "Untangle" };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <WelcomeForm googleFailed={Boolean(error)} />;
}
