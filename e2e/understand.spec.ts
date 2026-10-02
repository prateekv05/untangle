import { expect, test } from "./fixtures";
import { openDump, EXAMPLE } from "./helpers";
import { sessionCookieValue } from "./support";

const DUMP = "Need to finish SQL assignment, grocery shopping, call mom, gym, send resume to Sarah, work on app, buy toothpaste";

test("a failed read keeps the text and says so quietly", async ({ page }) => {
  await page.route("**/api/understand", (route) => route.fulfill({ status: 502, json: { error: "understand_failed" } }));
  await openDump(page);
  const box = page.getByRole("textbox", { name: "What's on your mind?" });
  await box.fill(EXAMPLE);
  await page.getByRole("button", { name: "Untangle my day" }).click();
  await expect(page.getByText("I couldn't read that just now. Your text is saved. Try again.")).toBeVisible({ timeout: 15_000 });
  await expect(box).toHaveValue(EXAMPLE);
});

test("the daily limit gets its own plain message", async ({ page }) => {
  await page.route("**/api/understand", (route) => route.fulfill({ status: 429, json: { error: "daily_limit" } }));
  await openDump(page);
  await page.getByRole("textbox", { name: "What's on your mind?" }).fill(EXAMPLE);
  await page.getByRole("button", { name: "Untangle my day" }).click();
  await expect(page.getByText(/today's limit/)).toBeVisible({ timeout: 15_000 });
});

// Real model, real database. Costs a few cents: opt in with RUN_AI_E2E=1 (and set AI_MODEL_FAST to a model with credit).
test.describe("real model", () => {
  test.skip(!process.env.RUN_AI_E2E, "set RUN_AI_E2E=1 to call the model");

  test("creates the day and tasks, remaps ids, and a second dump replaces the day", async ({ request, user }) => {
    const headers = { cookie: `authjs.session-token=${await sessionCookieValue(user)}` };
    const res = await request.post("/api/understand", { headers, data: { text: DUMP } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(7);
    const ids = new Set<string>(body.tasks.map((t: { id: string }) => t.id));
    for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
    for (const q of body.questions) expect(ids.has(q.taskId)).toBe(true);
    for (const g of body.groupings) for (const id of g.taskIds) expect(ids.has(id)).toBe(true);
    expect(body.questions.length).toBeLessThanOrEqual(3);

    const day = await (await request.get(`/api/day?date=${body.date}`, { headers })).json();
    expect(day.day.tasks.map((t: { id: string }) => t.id).sort()).toEqual([...ids].sort());
    expect(day.day.day.rawDump).toBe(DUMP);

    const again = await request.post("/api/understand", { headers, data: { text: "call the dentist" } });
    expect(again.status()).toBe(200);
    const day2 = await (await request.get(`/api/day?date=${(await again.json()).date}`, { headers })).json();
    expect(day2.day.tasks).toHaveLength(1);
  });
});
