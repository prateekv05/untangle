/**
 * Every query takes userId explicitly and filters by it. No query reads a cookie or session.
 * Each takes an optional Db last so the integration test can point at the test branch.
 * neon-http has no interactive transactions, so multi-step writes are single statements.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type Db } from "../client";
import { aiUsage, days, plans, settings, tasks, users } from "../schema";
import { DEFAULT_SETTINGS, type Plan, type Settings, type Task } from "../../lib/schemas";
import { AiLimitError, assertIsoDate, assertMoveTarget, cleanPatch, NotFoundError, rowToTask, type TaskPatch } from "./helpers";

export { AiLimitError, NotFoundError } from "./helpers";

export async function getUserById(userId: string, db: Db = getDb()) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function getSettings(userId: string, db: Db = getDb()): Promise<Settings> {
  // Selects from users so an account deleted mid-request inserts nothing instead of failing the foreign key.
  await db.execute(sql`insert into settings (user_id) select id from users where id = ${userId} on conflict do nothing`);
  const [row] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  if (!row) return { ...DEFAULT_SETTINGS }; // the user does not exist
  return { workStart: row.workStart, workEnd: row.workEnd, workDays: row.workDays, wake: row.wake, sleep: row.sleep, timezone: row.timezone };
}

export type NewTask = Omit<Task, "id"> & { position?: number };

export async function createDayWithTasks(
  userId: string,
  date: string,
  mode: "workday" | "dayoff",
  rawDump: string,
  newTasks: NewTask[],
  db: Db = getDb(),
) {
  assertIsoDate(date);
  const [day] = await db.insert(days).values({ userId, date, mode, rawDump }).returning();
  if (newTasks.length === 0) return { day, tasks: [] as Task[] };
  const rows = await db
    .insert(tasks)
    .values(newTasks.map((t, i) => ({ ...t, dayId: day.id, position: t.position ?? i })))
    .returning();
  rows.sort((a, b) => a.position - b.position);
  return { day, tasks: rows.map(rowToTask) };
}

/** Day, its non-deleted tasks, and the latest plan version. null when the user has no day for that date. */
export async function getDay(userId: string, date: string, db: Db = getDb()) {
  const [day] = await db.select().from(days).where(and(eq(days.userId, userId), eq(days.date, date))).limit(1);
  if (!day) return null;
  const [taskRows, [plan]] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.dayId, day.id)).orderBy(tasks.position),
    db.select().from(plans).where(eq(plans.dayId, day.id)).orderBy(desc(plans.version)).limit(1),
  ]);
  const visible = taskRows.filter((t) => t.status !== "deleted");
  return {
    day,
    tasks: visible.map((r) => ({ ...rowToTask(r), status: r.status, movedTo: r.movedTo })),
    plan: plan ?? null,
  };
}

/** Inserts the next version in one statement; the unique (day_id, version) index catches a concurrent writer. */
export async function savePlan(
  userId: string,
  dayId: string,
  trigger: "initial" | "replan" | "edit",
  instruction: string | null,
  plan: Plan,
  source: "llm" | "fallback",
  model: string | null,
  db: Db = getDb(),
) {
  const result = await db.execute(sql`
    insert into plans (day_id, version, trigger, instruction, snapshot, source, model)
    select d.id,
           coalesce((select max(p.version) from plans p where p.day_id = d.id), 0) + 1,
           ${trigger}::plan_trigger, ${instruction}, ${JSON.stringify(plan)}::jsonb, ${source}, ${model}
    from days d
    where d.id = ${dayId} and d.user_id = ${userId}
    returning id, version`);
  const row = result.rows[0] as { id: string; version: number } | undefined;
  if (!row) throw new NotFoundError("Day");
  return row;
}

export async function updateTask(userId: string, taskId: string, patch: TaskPatch, db: Db = getDb()) {
  const values = cleanPatch(patch);
  const [row] = await db
    .update(tasks)
    .set(values)
    .where(and(eq(tasks.id, taskId), inArray(tasks.dayId, db.select({ id: days.id }).from(days).where(eq(days.userId, userId)))))
    .returning();
  if (!row) throw new NotFoundError("Task");
  return rowToTask(row);
}

export async function moveTaskToLater(userId: string, taskId: string, toDate: string, db: Db = getDb()) {
  const [found] = await db
    .select({ date: days.date })
    .from(tasks)
    .innerJoin(days, eq(tasks.dayId, days.id))
    .where(and(eq(tasks.id, taskId), eq(days.userId, userId)))
    .limit(1);
  if (!found) throw new NotFoundError("Task");
  assertMoveTarget(found.date, toDate);
  return updateTaskStatus(userId, taskId, { status: "moved", movedTo: toDate }, db);
}

async function updateTaskStatus(userId: string, taskId: string, set: Partial<typeof tasks.$inferInsert>, db: Db) {
  const [row] = await db
    .update(tasks)
    .set(set)
    .where(and(eq(tasks.id, taskId), inArray(tasks.dayId, db.select({ id: days.id }).from(days).where(eq(days.userId, userId)))))
    .returning();
  if (!row) throw new NotFoundError("Task");
  return rowToTask(row);
}

/** Tasks moved to `date` from an earlier day, offered on that day's dump screen. */
export async function carryOver(userId: string, date: string, db: Db = getDb()) {
  assertIsoDate(date);
  const rows = await db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(days, eq(tasks.dayId, days.id))
    .where(and(eq(days.userId, userId), eq(tasks.status, "moved"), eq(tasks.movedTo, date)))
    .orderBy(tasks.position);
  return rows.map((r) => rowToTask(r.task));
}

/** Atomic: increments only while under the limit. Throws AiLimitError on the call that would exceed it. */
export async function incrementAiUsage(userId: string, day: string, limit: number, db: Db = getDb()): Promise<number> {
  assertIsoDate(day);
  const [row] = await db
    .insert(aiUsage)
    .values({ userId, day, calls: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: { calls: sql`${aiUsage.calls} + 1` },
      setWhere: sql`${aiUsage.calls} < ${limit}`,
    })
    .returning({ calls: aiUsage.calls });
  if (!row) throw new AiLimitError(limit);
  return row.calls;
}
