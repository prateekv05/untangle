/** Integration test against the Neon test branch. Run: npm run test:db (needs TEST_DATABASE_URL). */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { makeDb } from "../src/db/client";
import { AiLimitError, carryOver, createDayWithTasks, getDay, getSettings, getUserById, incrementAiUsage, moveTaskToLater, NotFoundError, savePlan, updateTask } from "../src/db/queries";
import { clearAuthAttempts, clearPassword, completeOnboarding, findUserByEmail, findUserByGoogleSub, recordAuthAttempt, setPassword, upsertGoogleUser } from "../src/db/queries/account";
import { deletePreset, listPresets, MAX_PRESETS, PresetLimitError, savePreset, saveSettings } from "../src/db/queries/presets";
import { users } from "../src/db/schema";
import { authenticatePassword } from "../src/lib/credentials";
import { hashPassword } from "../src/lib/password";
import { applyMeUpdate } from "../src/lib/me";
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

  assert.deepEqual(await getSettings("00000000-0000-4000-8000-000000000000", db), DEFAULT_SETTINGS); // unknown user: defaults, no throw
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

  // accounts: first sign-in creates, later sign-in returns the same row and keeps an edited name
  const sub = `sub-g-${tag}`;
  const g1 = await upsertGoogleUser({ sub, email: `G-${tag}@Test.invalid`, name: "Sam Google" }, db);
  ids.push(g1.id);
  assert.equal(g1.email, `g-${tag}@test.invalid`);
  assert.equal(g1.onboardedAt, null);
  assert.deepEqual(await getSettings(g1.id, db), DEFAULT_SETTINGS);
  const done = await completeOnboarding(g1.id, { name: "Sam", gender: null }, db);
  assert.ok(done.onboardedAt);
  const g2 = await upsertGoogleUser({ sub, email: g1.email, name: "Other Name" }, db);
  assert.equal(g2.id, g1.id);
  assert.equal(g2.name, "Sam");
  assert.equal(g2.onboardedAt?.getTime(), done.onboardedAt?.getTime());
  assert.equal((await findUserByGoogleSub(sub, db))?.id, g1.id);
  assert.equal((await findUserByEmail(g1.email.toUpperCase(), db))?.id, g1.id);

  // password set / clear
  await setPassword(g1.id, "salt:hash", db);
  assert.equal((await getUserById(g1.id, db))?.passwordHash, "salt:hash");
  await clearPassword(g1.id, db);
  assert.equal((await getUserById(g1.id, db))?.passwordHash, null);

  // rate limit: the 6th attempt in a window is blocked, a new window is allowed, clearing resets
  const key = `email:${tag}`;
  const now = new Date("2026-10-01T10:00:00Z");
  try {
    for (let i = 1; i <= 5; i++) assert.deepEqual(await recordAuthAttempt(key, { limit: 5, windowMs: 900_000, now }, db), { allowed: true, count: i });
    assert.equal((await recordAuthAttempt(key, { limit: 5, windowMs: 900_000, now }, db)).allowed, false);
    assert.equal((await recordAuthAttempt(key, { limit: 5, windowMs: 900_000, now: new Date("2026-10-01T10:15:00Z") }, db)).allowed, true);
    await clearAuthAttempts(key, db);
    assert.equal((await recordAuthAttempt(key, { limit: 5, windowMs: 900_000, now }, db)).count, 1);
  } finally {
    await clearAuthAttempts(key, db);
  }

  // /api/me logic: finishing needs a name; name and gender save step by step
  const u3 = await mk("c");
  ids.push(u3.id);
  await assert.rejects(applyMeUpdate(u3.id, { complete: true }, db));
  assert.equal((await applyMeUpdate(u3.id, { name: "Riley" }, db)).onboarded, false);
  assert.equal((await applyMeUpdate(u3.id, { gender: "man" }, db)).gender, "man");
  assert.equal((await applyMeUpdate(u3.id, { gender: null }, db)).gender, null);
  const fin = await applyMeUpdate(u3.id, { complete: true }, db);
  assert.deepEqual([fin.name, fin.onboarded], ["Riley", true]);

  // password sign-in: same null for wrong password, unknown email and no password; locks after 5 failures
  await setPassword(g1.id, await hashPassword("a long enough password"), db);
  const ip = `test-${tag}`;
  const good = { email: g1.email.toUpperCase(), password: "a long enough password" };
  try {
    assert.equal(await authenticatePassword(good, ip, db), g1.id);
    assert.equal(await authenticatePassword({ ...good, password: "wrong password!!" }, ip, db), null);
    assert.equal(await authenticatePassword({ email: `nobody-${tag}@test.invalid`, password: "wrong password!!" }, ip, db), null);
    assert.equal(await authenticatePassword({ email: "not-an-email", password: "x" }, ip, db), null);
    assert.equal(await authenticatePassword(good, ip, db), g1.id); // success cleared the email counter
    for (let i = 0; i < 5; i++) await authenticatePassword({ ...good, password: "wrong password!!" }, ip, db);
    assert.equal(await authenticatePassword(good, ip, db), null); // locked, even with the right password
    await clearPassword(g1.id, db);
    assert.equal(await authenticatePassword({ email: g1.email, password: "a long enough password" }, ip, db), null);
  } finally {
    await clearAuthAttempts(`email:${g1.email}`, db);
    await clearAuthAttempts(`ip:${ip}`, db);
    await clearAuthAttempts(`email:nobody-${tag}@test.invalid`, db);
  }

  // settings and presets: per user, one preset per phrase in any case, capped, delete only your own
  const mine = { verb: "Swim", location: "outside", kind: "health", defaultDurationMin: 45 } as const;
  const saved = await savePreset(u3.id, mine, db);
  const again = await savePreset(u3.id, { ...mine, verb: "swim", defaultDurationMin: null }, db);
  const list3 = await listPresets(u3.id, db);
  assert.equal(list3.length, 1);
  assert.deepEqual([list3[0].verb, list3[0].defaultDurationMin], ["swim", null]);
  assert.notEqual(saved.id, again.id);
  assert.deepEqual(await listPresets(a.id, db), []);
  await expectNotFound(deletePreset(a.id, again.id, db)); // someone else's
  await deletePreset(u3.id, again.id, db);
  await expectNotFound(deletePreset(u3.id, again.id, db));
  for (let i = 0; i < MAX_PRESETS; i++) await savePreset(u3.id, { ...mine, verb: `p${i}` }, db);
  await assert.rejects(savePreset(u3.id, { ...mine, verb: "one too many" }, db), PresetLimitError);
  await savePreset(u3.id, { ...mine, verb: "P0", defaultDurationMin: 10 }, db); // replacing at the cap is allowed
  assert.equal((await listPresets(u3.id, db)).length, MAX_PRESETS);

  const next = { ...DEFAULT_SETTINGS, workStart: "08:30", workDays: [1, 3], timezone: "Europe/London" };
  assert.deepEqual(await saveSettings(u3.id, next, db), next);
  assert.deepEqual(await getSettings(u3.id, db), next);
  assert.deepEqual(await getSettings(a.id, db), DEFAULT_SETTINGS);

  console.log("db integration: all passed");
} finally {
  for (const id of ids) await db.delete(users).where(eq(users.id, id)); // cascades
}
