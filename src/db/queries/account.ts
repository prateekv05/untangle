/** Account queries (Phase 3). Like the rest of src/db/queries: explicit ids, optional Db last, no session access. */
import { eq, sql } from "drizzle-orm";
import { getDb, type Db } from "../client";
import { accountFeedback, authAttempts, settings, users } from "../schema";
import { normalizeEmail, NotFoundError, windowStart, type Gender } from "./helpers";

export async function findUserByGoogleSub(sub: string, db: Db = getDb()) {
  const [row] = await db.select().from(users).where(eq(users.googleSub, sub)).limit(1);
  return row ?? null;
}

export async function findUserByEmail(email: string, db: Db = getDb()) {
  const [row] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return row ?? null;
}

/**
 * First sign-in creates the account and its default settings; later sign-ins return the same row.
 * The name is only taken from Google on creation, so a name the user edited is never overwritten.
 */
export async function upsertGoogleUser(input: { sub: string; email: string; name?: string | null }, db: Db = getDb()) {
  const email = normalizeEmail(input.email);
  const [user] = await db
    .insert(users)
    .values({ googleSub: input.sub, email, name: input.name?.trim() || null })
    .onConflictDoUpdate({ target: users.googleSub, set: { email } })
    .returning();
  await db.insert(settings).values({ userId: user.id }).onConflictDoNothing();
  return user;
}

export async function completeOnboarding(userId: string, input: { name: string; gender: Gender | null }, db: Db = getDb()) {
  const [row] = await db
    .update(users)
    .set({ name: input.name, gender: input.gender, onboardedAt: sql`coalesce(${users.onboardedAt}, now())` })
    .where(eq(users.id, userId))
    .returning();
  if (!row) throw new NotFoundError("User");
  return row;
}

export async function updateAccount(userId: string, patch: { name?: string; gender?: Gender | null }, db: Db = getDb()) {
  const set: Partial<typeof users.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.gender !== undefined) set.gender = patch.gender;
  if (Object.keys(set).length === 0) {
    const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!row) throw new NotFoundError("User");
    return row;
  }
  const [row] = await db.update(users).set(set).where(eq(users.id, userId)).returning();
  if (!row) throw new NotFoundError("User");
  return row;
}

export async function setPassword(userId: string, passwordHash: string, db: Db = getDb()) {
  const [row] = await db.update(users).set({ passwordHash }).where(eq(users.id, userId)).returning({ id: users.id });
  if (!row) throw new NotFoundError("User");
}

export async function clearPassword(userId: string, db: Db = getDb()) {
  const [row] = await db.update(users).set({ passwordHash: null }).where(eq(users.id, userId)).returning({ id: users.id });
  if (!row) throw new NotFoundError("User");
}

/**
 * Counts one attempt for `key` in the current fixed window and says whether it is allowed.
 * Atomic: the increment only happens while under `limit`, so blocked attempts do not extend the block.
 */
export async function recordAuthAttempt(
  key: string,
  opts: { limit: number; windowMs: number; now?: Date },
  db: Db = getDb(),
): Promise<{ allowed: boolean; count: number }> {
  const start = windowStart(opts.now ?? new Date(), opts.windowMs);
  const [row] = await db
    .insert(authAttempts)
    .values({ key, windowStart: start, count: 1 })
    .onConflictDoUpdate({
      target: [authAttempts.key, authAttempts.windowStart],
      set: { count: sql`${authAttempts.count} + 1` },
      setWhere: sql`${authAttempts.count} < ${opts.limit}`,
    })
    .returning({ count: authAttempts.count });
  if (row) return { allowed: true, count: row.count };
  return { allowed: false, count: opts.limit };
}

/**
 * Removes the user and everything they own. Settings, presets, days (and through them tasks and plans), AI usage and the draft
 * all cascade from the users row. Sign-in attempt counters are keyed by email, so those go too.
 */
export async function deleteAccount(userId: string, reason?: string, db: Db = getDb()) {
  const [row] = await db.delete(users).where(eq(users.id, userId)).returning({ email: users.email });
  if (!row) throw new NotFoundError("User");
  await db.delete(authAttempts).where(eq(authAttempts.key, `email:${row.email}`));
  if (reason) await db.insert(accountFeedback).values({ reason }).catch(() => {}); // after the delete, with no user id so it cannot be traced back; never fails a delete that already happened
}

/** A successful sign-in clears the failure count for that key. */
export async function clearAuthAttempts(key: string, db: Db = getDb()) {
  await db.delete(authAttempts).where(eq(authAttempts.key, key));
}
