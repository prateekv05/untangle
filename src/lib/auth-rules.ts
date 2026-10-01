/** Pure rules for the sign-in gate. No I/O, so they are unit-tested and shared by the proxy and the UI. */

export const WELCOME_PATH = "/welcome";
export const ONBOARDING_START = "/welcome/name";

export type GateState = { signedIn: boolean; onboarded: boolean };

/**
 * Where a request for `pathname` should be sent instead, or null to let it through.
 * Signed out: only Welcome. Signed in, not onboarded: only the onboarding steps. Onboarded: never Welcome or onboarding.
 */
export function redirectFor(pathname: string, { signedIn, onboarded }: GateState): string | null {
  const isWelcome = pathname === WELCOME_PATH || pathname === `${WELCOME_PATH}/`;
  const isOnboarding = pathname.startsWith(`${WELCOME_PATH}/`) && !isWelcome;
  if (!signedIn) return isWelcome ? null : WELCOME_PATH;
  if (!onboarded) return isOnboarding ? null : ONBOARDING_START;
  return isWelcome || isOnboarding ? "/" : null;
}

/** Best-effort client IP for rate limiting. On Vercel the first x-forwarded-for entry is the client. */
export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export const SIGN_IN_LIMITS = {
  windowMs: 15 * 60 * 1000,
  perEmail: 5,
  perIp: 20,
} as const;
