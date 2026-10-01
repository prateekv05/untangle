/** Email-and-password check for the Credentials provider. Kept apart from Auth.js so it can be tested against the database. */
import { z } from "zod";
import type { Db } from "../db/client";
import { getDb } from "../db/client";
import { clearAuthAttempts, findUserByEmail, recordAuthAttempt } from "../db/queries/account";
import { normalizeEmail } from "../db/queries/helpers";
import { SIGN_IN_LIMITS } from "./auth-rules";
import { dummyHash, verifyPassword } from "./password";

const Input = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });

/**
 * Returns the user id, or null for anything that should look like "that didn't match":
 * bad input, unknown email, wrong password, an account with no password, or too many attempts.
 * Every failure takes the same path so the caller cannot tell them apart.
 */
export async function authenticatePassword(raw: unknown, ip: string, db: Db = getDb()): Promise<string | null> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return null;
  const email = normalizeEmail(parsed.data.email);
  const emailKey = `email:${email}`;
  const { windowMs, perEmail, perIp } = SIGN_IN_LIMITS;

  const [byIp, byEmail] = await Promise.all([
    recordAuthAttempt(`ip:${ip}`, { limit: perIp, windowMs }, db),
    recordAuthAttempt(emailKey, { limit: perEmail, windowMs }, db),
  ]);
  if (!byIp.allowed || !byEmail.allowed) return null;

  const user = await findUserByEmail(email, db);
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await dummyHash()));
  if (!user?.passwordHash || !ok) return null;

  await clearAuthAttempts(emailKey, db);
  return user.id;
}
