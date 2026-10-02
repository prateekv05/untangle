import { test as base, expect } from "@playwright/test";
import { createUser, deleteCreatedUsers, signInAs, type TestUser } from "../e2e/support";
import { makeDb } from "../src/db/client";
import { createDayWithTasks, getSettings, savePlan } from "../src/db/queries";
import { fixtureTasksFor } from "../src/fixtures/example";
import { EXAMPLE } from "../e2e/helpers";
import { planDay } from "../src/lib/planner";
import { localClock } from "../src/lib/timezone";
import { DEFAULT_SETTINGS } from "../src/lib/schemas";

const test = base.extend<{ user: TestUser }>({
  user: async ({ context, baseURL }, provide) => {
    const user = await createUser({ onboarded: true });
    await signInAs(context, user, baseURL!);
    await provide(user);
    await deleteCreatedUsers();
  },
});

/** Today's day with a real plan, saved straight into the test database (the real routes read it back). */
async function seedToday(userId: string) {
  const db = makeDb(process.env.TEST_DATABASE_URL!);
  const date = localClock((await getSettings(userId, db)).timezone).date;
  const fixtures = (fixtureTasksFor(EXAMPLE) ?? []).map(({ id: _id, ...t }) => t);
  const { day, tasks } = await createDayWithTasks(userId, date, "workday", EXAMPLE, fixtures, db);
  await savePlan(userId, day.id, "initial", null, planDay(tasks, DEFAULT_SETTINGS, { mode: "workday" }), "fallback", null, db);
}

test("the manifest and icons make the app installable", async ({ page, request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m).toMatchObject({ name: "Untangle", display: "standalone", start_url: "/" });
  for (const icon of m.icons as { src: string }[]) expect((await request.get(icon.src)).status(), icon.src).toBe(200);
  expect((await request.get("/icons/apple-touch-icon.png")).status()).toBe(200);
  expect((await request.get("/sw.js")).status()).toBe(200);
  await page.goto("/welcome");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test("today's plan opens in airplane mode and edits are disabled", async ({ page, context, user }) => {
  await seedToday(user.id);
  await page.goto("/");
  await page.getByRole("button", { name: "Re-plan my day" }).waitFor();
  // The first load ran before the service worker controlled the page: wait for it, then load once more so the day is cached.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.getByRole("button", { name: "Re-plan my day" }).waitFor();
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes("untangle-day"))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await page.getByTestId("timeline").waitFor();
  await expect(page.getByText("You're offline.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Re-plan my day" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Talk to re-plan" })).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: /^Finish / }).first()).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByText("You're offline.")).toBeHidden();
  await expect(page.getByRole("button", { name: "Re-plan my day" })).toBeEnabled();
});
