"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export type PasswordState = { failed: boolean; ok: boolean; email: string };

/** Wrong password, unknown email and rate limiting all land here as one answer. */
export async function signInWithPassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const email = String(form.get("email") ?? "");
  try {
    // No server redirect: the client does a full navigation so the proxy gate (onboarding or Dump) runs on a fresh request.
    await signIn("credentials", { email, password: form.get("password"), redirect: false });
  } catch (e) {
    if (e instanceof AuthError) return { failed: true, ok: false, email }; // email is returned so the form can keep it
    throw e;
  }
  return { failed: false, ok: true, email };
}

/** Clears the session cookie. The client then navigates to Welcome with a full page load. */
export async function signOutAction() {
  await signOut({ redirect: false });
}
