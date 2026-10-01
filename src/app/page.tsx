import { UntangleApp } from "@/components/untangle-app";
import { UnauthorizedError, requireUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  // The proxy already keeps signed-out people out; this also covers a cookie for an account that no longer exists.
  const user = await requireUser().catch((e) => {
    if (e instanceof UnauthorizedError) redirect("/welcome");
    throw e;
  });
  return <UntangleApp name={user.name} />;
}
