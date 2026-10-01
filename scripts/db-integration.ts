/** Integration test against the Neon test branch. Run: npm run test:db (needs TEST_DATABASE_URL). */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { makeDb } from "../src/db/client";
import { AiLimitError, carryOver, createDayWithTasks, getDay, getSettings, getUserById, incrementAiUsage, moveTaskToLater, NotFoundError, savePlan, updateTask } from "../src/db/queries";
import { users } from "../src/db/schema";
import { planDay } from "../src/lib/planner";
import { DEFAULT_SETTINGS, type Plan } from "../src/lib/schemas";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set");
const db = makeDb(url);

const tag = Math.random().toString(36).slice(2, 8);
const mk = async (n: string) =>
  (await db.insert(users).values({ email: `${n}-${tag}@test.invalid`, googleSub: `sub-${n}-${tag}` }).returning())[0];

const ids: string[] = [];
async function expectNotFound(p: Promise<unknown>) {
  await assert.rejects(p, (e) => e instanceof NotFoundError);
}

try {
  const [a, b] = [await mk("a"), await mk("b")];
  ids.push(a.id, b.id);
  assert.equal((await getUserById(a.id, db))?.email, a.email);

  const s = await getSettings(a.id, db);
  assert.deepEqual(s, DEFAULT_SETTINGS);
  await getSettings(a.id, db); // idempotent

  const { day, tasks } = await createDayWithTasks(a.id, "2026-10-01", "workday", "gym, call mum", [
    { title: "Gym", location: "outside", kind: "health", durationMin: 60, durationSource: "user", fixedStart: null, due: "today" },
    { title: "Call mum", location: "anywhere", kind: "call", durationMin: 20, durationSource: "estimated", fixedStart: null, due: null },
  ], db);
  assert.equal(tasks.length, 2);

  const plan: Plan = planDay(tasks, s, { mode: "workday" });
  const p1 = await savePlan(a.id, day.id, "initial", null, plan, "fallback", null, db);
  const p2 = await savePlan(a.id, day.id, "replan", "I'm tired", plan, "llm", "anthropic:claude-sonnet-5-5", db);
  assert.deepEqual([p1.version, p2.version], [1, 2]);

  const got = await getDay(a.id, "2026-10-01", db);
  assert.equal(got?.tasks.length, 2);
  assert.equal(got?.plan?.version, 2);

  const updated = await updateTask(a.id, tasks[0].id, { durationMin: 45 }, db);
  assert.equal(updated.durationMin, 45);

  await moveTaskToLater(a.id, tasks[1].id, "2026-10-02", db);
  assert.equal((await carryOver(a.id, "2026-10-02", db)).length, 1);
  assert.equal((await carryOver(a.id, "2026-10-03", db)).length, 0);

  // isolation: user B cannot see or touch A's data
  assert.equal(await getDay(b.id, "2026-10-01", db), null);
  assert.equal((await carryOver(b.id, "2026-10-02", db)).length, 0);
  await expectNotFound(updateTask(b.id, tasks[0].id, { title: "hijack" }, db));
  await expectNotFound(moveTaskToLater(b.id, tasks[0].id, "2026-10-05", db));
  await expectNotFound(savePlan(b.id, day.id, "edit", null, plan, "fallback", null, db));

  // ai usage: the 41st call is rejected
  for (let i = 1; i <= 40; i++) assert.equal(await incrementAiUsage(a.id, "2026-10-01", 40, db), i);
  await assert.rejects(incrementAiUsage(a.id, "2026-10-01", 40, db), AiLimitError);
  assert.equal(await incrementAiUsage(a.id, "2026-10-02", 40, db), 1);

  console.log("db integration: all passed");
} finally {
  for (const id of ids) await db.delete(users).where(eq(users.id, id)); // cascades
}
