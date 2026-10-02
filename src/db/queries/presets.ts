/** Preset and settings queries (Phase 3). Same rules as the rest of src/db/queries: explicit userId, optional Db last. */
import { and, count, eq, sql } from "drizzle-orm";
import { getDb, type Db } from "../client";
import { presets, settings } from "../schema";
import type { Settings } from "../../lib/schemas";
import { NotFoundError } from "./helpers";

export const MAX_PRESETS = 50;

export class PresetLimitError extends Error {
  constructor() {
    super(`At most ${MAX_PRESETS} presets`);
    this.name = "PresetLimitError";
  }
}

type PresetRow = typeof presets.$inferSelect;
export type PresetInput = { verb: string; location: PresetRow["location"]; kind: PresetRow["kind"]; defaultDurationMin: number | null };

const toPreset = (r: PresetRow) => ({ id: r.id, verb: r.verb, location: r.location, kind: r.kind, defaultDurationMin: r.defaultDurationMin });

export async function listPresets(userId: string, db: Db = getDb()) {
  const rows = await db.select().from(presets).where(eq(presets.userId, userId)).orderBy(presets.verb);
  return rows.map(toPreset);
}

/** Saving a phrase that already exists (in any letter case) replaces it, so there is one preset per phrase. */
export async function savePreset(userId: string, input: PresetInput, db: Db = getDb()) {
  const verb = input.verb.trim();
  const [{ n }] = await db
    .select({ n: count() })
    .from(presets)
    .where(and(eq(presets.userId, userId), sql`lower(${presets.verb}) <> lower(${verb})`));
  if (n >= MAX_PRESETS) throw new PresetLimitError();
  // One statement: drop other-case duplicates, then upsert on the exact phrase.
  const result = await db.execute(sql`
    with dropped as (
      delete from presets where user_id = ${userId} and lower(verb) = lower(${verb}) and verb <> ${verb}
    )
    insert into presets (user_id, verb, location, kind, default_duration_min)
    values (${userId}, ${verb}, ${input.location}::location, ${input.kind}::kind, ${input.defaultDurationMin})
    on conflict (user_id, verb) do update
      set location = excluded.location, kind = excluded.kind, default_duration_min = excluded.default_duration_min
    returning id, verb, location, kind, default_duration_min as "defaultDurationMin"`);
  return result.rows[0] as ReturnType<typeof toPreset>;
}

export async function deletePreset(userId: string, presetId: string, db: Db = getDb()) {
  const rows = await db.delete(presets).where(and(eq(presets.id, presetId), eq(presets.userId, userId))).returning({ id: presets.id });
  if (rows.length === 0) throw new NotFoundError("Preset");
}

export async function saveSettings(userId: string, s: Settings, db: Db = getDb()): Promise<Settings> {
  const [row] = await db
    .insert(settings)
    .values({ userId, ...s })
    .onConflictDoUpdate({ target: settings.userId, set: s })
    .returning();
  return { workStart: row.workStart, workEnd: row.workEnd, workDays: row.workDays, wake: row.wake, sleep: row.sleep, timezone: row.timezone };
}

/** Sets only the timezone, creating default settings if the account has none yet. */
export async function setTimezone(userId: string, timezone: string, db: Db = getDb()) {
  await db.execute(sql`
    insert into settings (user_id, timezone) select id, ${timezone} from users where id = ${userId}
    on conflict (user_id) do update set timezone = excluded.timezone`);
}
