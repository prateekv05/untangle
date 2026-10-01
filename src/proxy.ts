import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { redirectFor } from "@/lib/auth-rules";

// Pages only. API routes check the session themselves through requireUser(), and /api/auth/* must stay open.
export default auth((req) => {
  const session = req.auth;
  const to = redirectFor(req.nextUrl.pathname, {
    signedIn: Boolean(session?.user?.id),
    onboarded: Boolean(session?.user?.onboarded),
  });
  if (to) return NextResponse.redirect(new URL(to, req.nextUrl));
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|icons|sw\\.js|swe-worker.*|manifest\\.webmanifest|favicon\\.ico).*)"],
};
