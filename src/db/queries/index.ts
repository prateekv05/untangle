/**
 * Every query takes userId explicitly and filters by it. No query reads a cookie or session.
 * Each takes an optional Db last so the integration test can point at the test branch.
 * neon-http has no interactive transactions, so multi-step writes are single statements.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type Db } from "../client";
import { aiUsage, days, plans, settings, tasks, users } from "../schema";
import { DEFAULT_SETTINGS, Plan as PlanSchema, type Plan, type Settings, type Task } from "../../lib/schemas";
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

/** One day per user per date: a fresh dump for a date that already has a day replaces it (tasks and plans go with it). */
export async function replaceDayWithTasks(
  userId: string,
  date: string,
  mode: "workday" | "dayoff",
  rawDump: string,
  newTasks: NewTask[],
  db: Db = getDb(),
) {
  assertIsoDate(date);
  await db.delete(days).where(and(eq(days.userId, userId), eq(days.date, date)));
  return createDayWithTasks(userId, date, mode, rawDump, newTasks, db);
}

/** Adds tasks to the end of a day that already exists, leaving its tasks and plans untouched. Returns the new tasks in order. */
export async function appendTasksToDay(userId: string, dayId: string, newTasks: Array<Omit<Task, "id">>, db: Db = getDb()): Promise<Task[]> {
  if (!(await getDayById(userId, dayId, db))) throw new NotFoundError("Day");
  if (newTasks.length === 0) return [];
  const [{ next }] = await db.select({ next: sql<number>`coalesce(max(${tasks.position}), -1) + 1` }).from(tasks).where(eq(tasks.dayId, dayId));
  const rows = await db.insert(tasks).values(newTasks.map((t, i) => ({ ...t, dayId, position: Number(next) + i }))).returning();
  rows.sort((a, b) => a.position - b.position);
  return rows.map(rowToTask);
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

/** A day by id, only if it is the user's. */
export async function getDayById(userId: string, dayId: string, db: Db = getDb()) {
  const [day] = await db.select().from(days).where(and(eq(days.id, dayId), eq(days.userId, userId))).limit(1);
  return day ?? null;
}

export async function setDayMode(userId: string, dayId: string, mode: "workday" | "dayoff", db: Db = getDb()) {
  await db.update(days).set({ mode }).where(and(eq(days.id, dayId), eq(days.userId, userId)));
}

export type TaskSyncItem = Omit<Task, "id"> & { id?: string };

/**
 * Makes the day's open tasks exactly `items`, in order: known ids are updated, items without a known id are inserted,
 * open tasks that are missing are marked deleted. Returns the open tasks. neon-http has no transactions, so this is
 * a short run of single statements; a retry converges on the same result.
 */
export async function syncDayTasks(userId: string, dayId: string, items: TaskSyncItem[], db: Db = getDb()): Promise<Task[]> {
  if (!(await getDayById(userId, dayId, db))) throw new NotFoundError("Day");
  const existing = await db.select().from(tasks).where(and(eq(tasks.dayId, dayId), eq(tasks.status, "open")));
  const open = new Set(existing.map((r) => r.id));
  const keep = new Set(items.flatMap((i) => (i.id && open.has(i.id) ? [i.id] : [])));
  const gone = [...open].filter((id) => !keep.has(id));
  if (gone.length) await db.update(tasks).set({ status: "deleted" }).where(and(eq(tasks.dayId, dayId), inArray(tasks.id, gone)));
  const out: Task[] = [];
  for (const [position, { id, ...fields }] of items.entries()) {
    if (id && open.has(id)) {
      const [row] = await db.update(tasks).set({ ...fields, position }).where(and(eq(tasks.id, id), eq(tasks.dayId, dayId))).returning();
      out.push(rowToTask(row));
    } else {
      const [row] = await db.insert(tasks).values({ ...fields, dayId, position }).returning();
      out.push(rowToTask(row));
    }
  }
  return out;
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

export type TaskStatus = "open" | "done" | "moved" | "deleted";
/** A task as the day screen sees it: the domain Task plus where it stands. */
export type DayTask = Task & { status: Exclude<TaskStatus, "deleted">; movedTo: string | null };
export type DayState = {
  day: typeof days.$inferSelect;
  /** Every task of the day, deleted ones included (undo needs them). */
  rows: Array<Task & { status: TaskStatus; movedTo: string | null }>;
  plan: { version: number; snapshot: Plan; source: string; model: string | null } | null;
};

/** The day by id (only if it is the user's), all its tasks in order, and the latest plan version. */
export async function getDayState(userId: string, dayId: string, db: Db = getDb()): Promise<DayState | null> {
  const day = await getDayById(userId, dayId, db);
  if (!day) return null;
  const [rows, [plan]] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.dayId, dayId)).orderBy(tasks.position),
    db.select().from(plans).where(eq(plans.dayId, dayId)).orderBy(desc(plans.version)).limit(1),
  ]);
  return {
    day,
    rows: rows.map((r) => ({ ...rowToTask(r), status: r.status, movedTo: r.movedTo })),
    plan: plan ? { version: plan.version, snapshot: PlanSchema.parse(plan.snapshot), source: plan.source, model: plan.model } : null,
  };
}

/** One saved plan version of a day (only if the day is the user's). */
export async function getPlanVersion(userId: string, dayId: string, version: number, db: Db = getDb()) {
  if (!(await getDayById(userId, dayId, db))) return null;
  const [row] = await db.select().from(plans).where(and(eq(plans.dayId, dayId), eq(plans.version, version))).limit(1);
  return row ? { version: row.version, snapshot: PlanSchema.parse(row.snapshot), source: row.source, model: row.model } : null;
}

/** Adds a task to the end of an existing day. */
export async function addTaskToDay(userId: string, dayId: string, task: Omit<Task, "id">, db: Db = getDb()): Promise<Task> {
  if (!(await getDayById(userId, dayId, db))) throw new NotFoundError("Day");
  const [{ next }] = await db.select({ next: sql<number>`coalesce(max(${tasks.position}), -1) + 1` }).from(tasks).where(eq(tasks.dayId, dayId));
  const [row] = await db.insert(tasks).values({ ...task, dayId, position: Number(next) }).returning();
  return rowToTask(row);
}

export async function setTaskStatus(userId: string, taskId: string, status: TaskStatus, movedTo: string | null = null, db: Db = getDb()) {
  return updateTaskStatus(userId, taskId, { status, movedTo: status === "moved" ? movedTo : null }, db);
}

export type TaskRestore = Task & { status: Exclude<TaskStatus, "deleted">; movedTo: string | null };

/**
 * Puts the day's tasks back to `restore` exactly. Tasks of the day that are not listed (added since) are deleted.
 * Every id must belong to the day; the caller has checked that.
 */
export async function restoreDayTasks(userId: string, dayId: string, restore: TaskRestore[], db: Db = getDb()): Promise<void> {
  if (!(await getDayById(userId, dayId, db))) throw new NotFoundError("Day");
  const listed = new Set(restore.map((t) => t.id));
  const existing = await db.select({ id: tasks.id, status: tasks.status }).from(tasks).where(eq(tasks.dayId, dayId));
  const extra = existing.filter((r) => !listed.has(r.id) && r.status !== "deleted").map((r) => r.id);
  if (extra.length) await db.update(tasks).set({ status: "deleted", movedTo: null }).where(and(eq(tasks.dayId, dayId), inArray(tasks.id, extra)));
  for (const { id, status, movedTo, ...fields } of restore) {
    await db.update(tasks).set({ ...fields, status, movedTo: status === "moved" ? movedTo : null }).where(and(eq(tasks.id, id), eq(tasks.dayId, dayId)));
  }
}
