/**
 * e2e accounts. Google sign-in cannot run in a test, so a signed-in browser is made at the Auth.js boundary:
 * a real user row in the Neon test branch plus a real session cookie signed with AUTH_SECRET.
 * Everything after that (proxy, requireUser, routes, database) is the production code path.
 */
import type { BrowserContext } from "@playwright/test";
import { encode } from "@auth/core/jwt";
import { eq, inArray, sql } from "drizzle-orm";
import { makeDb } from "../src/db/client";
import { upsertGoogleUser } from "../src/db/queries/account";
import { users } from "../src/db/schema";

const COOKIE = "authjs.session-token"; // the non-secure name Auth.js uses over http

const db = () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.local)");
  return makeDb(url);
};

export type TestUser = { id: string; email: string; onboarded: boolean };

const created: string[] = [];

export async function createUser(opts: { onboarded: boolean; name?: string | null } = { onboarded: true }): Promise<TestUser> {
  const tag = Math.random().toString(36).slice(2, 10);
  const email = `e2e-${tag}@test.invalid`;
  const row = await upsertGoogleUser({ sub: `e2e-${tag}`, email, name: opts.name ?? null }, db());
  created.push(row.id);
  if (opts.onboarded) {
    await db().update(users).set({ onboardedAt: sql`now()` }).where(eq(users.id, row.id));
  }
  return { id: row.id, email, onboarded: opts.onboarded };
}

export async function deleteCreatedUsers(): Promise<void> {
  if (created.length === 0) return;
  await db().delete(users).where(inArray(users.id, created.splice(0))); // settings, presets, days cascade
}

export async function sessionCookieValue(user: Pick<TestUser, "id" | "onboarded">): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set (see .env.local)");
  return encode({ token: { sub: user.id, uid: user.id, onboarded: user.onboarded }, secret, salt: COOKIE, maxAge: 60 * 60 });
}

export async function signInAs(context: BrowserContext, user: TestUser, baseURL: string): Promise<void> {
  await context.addCookies([{ name: COOKIE, value: await sessionCookieValue(user), url: baseURL, httpOnly: true, sameSite: "Lax" }]);
}
