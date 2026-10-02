/** Read-only history of planned days. Same rules as the rest of src/db/queries: explicit userId, optional Db last. */
import { sql } from "drizzle-orm";
import { getDb, type Db } from "../client";
import { getDay, getDayById } from "./index";

export const HISTORY_LIMIT = 1000;

export type HistoryItem = { dayId: string; date: string; mode: "workday" | "dayoff"; total: number; done: number; moved: number };

/** The user's planned days, newest first, all of them (a row each, so a thousand is years). A day that never got a plan (a dump left on Understand) is not history. */
export async function listHistory(userId: string, db: Db = getDb()): Promise<HistoryItem[]> {
  const result = await db.execute(sql`
    select d.id as "dayId", to_char(d.date, 'YYYY-MM-DD') as date, d.mode,
           count(t.id) filter (where t.status <> 'deleted')::int as total,
           count(t.id) filter (where t.status = 'done')::int as done,
           count(t.id) filter (where t.status = 'moved')::int as moved
    from days d
    left join tasks t on t.day_id = d.id
    where d.user_id = ${userId} and exists (select 1 from plans p where p.day_id = d.id)
    group by d.id
    order by d.date desc
    limit ${HISTORY_LIMIT}`);
  return result.rows as HistoryItem[];
}

/** One past day with its tasks and latest plan, only if it is the user's. */
export async function getHistoryDay(userId: string, dayId: string, db: Db = getDb()) {
  const day = await getDayById(userId, dayId, db);
  if (!day) return null;
  const full = await getDay(userId, day.date, db);
  return full?.plan ? full : null;
}
