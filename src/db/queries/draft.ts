/** The unfinished-list draft. Same rules as the rest of src/db/queries: explicit userId, optional Db last. */
import { eq } from "drizzle-orm";
import { getDb, type Db } from "../client";
import { drafts } from "../schema";
import { DRAFT_MAX_AGE_DAYS, DraftPayload } from "../../lib/draft";

/** The saved draft, or null when there is none, it is older than a week, or it no longer matches the current shape. */
export async function getDraft(userId: string, db: Db = getDb()): Promise<DraftPayload | null> {
  const [row] = await db.select().from(drafts).where(eq(drafts.userId, userId)).limit(1);
  if (!row) return null;
  const expired = Date.now() - row.updatedAt.getTime() > DRAFT_MAX_AGE_DAYS * 86_400_000;
  const parsed = DraftPayload.safeParse(row.payload);
  if (expired || !parsed.success) {
    await deleteDraft(userId, db);
    return null;
  }
  return parsed.data;
}

export async function saveDraft(userId: string, payload: DraftPayload, db: Db = getDb()) {
  const updatedAt = new Date();
  await db.insert(drafts).values({ userId, payload, updatedAt }).onConflictDoUpdate({ target: drafts.userId, set: { payload, updatedAt } });
}

export async function deleteDraft(userId: string, db: Db = getDb()) {
  await db.delete(drafts).where(eq(drafts.userId, userId));
}
