import { test as base, expect } from "@playwright/test";
import { fixtureTasksFor } from "../src/fixtures/example";
import { planDay } from "../src/lib/planner";
import { DEFAULT_SETTINGS, type Task } from "../src/lib/schemas";
import { deriveQuestions, tasksFromText } from "../src/lib/guess";
import { createUser, deleteCreatedUsers, signInAs, type TestUser } from "./support";

/** `test` with a signed-in, onboarded account (no name, so headings read "What's on your mind?"). */
export const test = base.extend<{ user: TestUser; understandStub: void }>({
  // The screens tests exercise the UI, not the model: /api/understand and /api/plan answer from the Phase 1 fixtures and planDay(). The real routes have their own tests.
  understandStub: [
    async ({ page }, use) => {
      const ids = new Map<string, string>(); // title -> fixture id: the client sends no ids it made up, so the stub puts them back
      await page.route("**/api/understand", async (route) => {
        const { text } = route.request().postDataJSON() as { text: string };
        const tasks = fixtureTasksFor(text) ?? tasksFromText(text, []);
        tasks.forEach((t) => ids.set(t.title, t.id));
        await route.fulfill({ json: { dayId: "stub", date: "2026-10-03", mode: "workday", planFor: "today", tasks, questions: deriveQuestions(tasks), groupings: [], model: "stub" } });
      });
      await page.route("**/api/plan", async (route) => {
        const body = route.request().postDataJSON() as { mode: "workday" | "dayoff"; tasks: Array<Omit<Task, "id"> & { id?: string }> };
        const tasks: Task[] = body.tasks.map((t, i) => ({ ...t, id: t.id ?? ids.get(t.title) ?? `n${i + 1}` }));
        const plan = planDay(tasks, DEFAULT_SETTINGS, { mode: body.mode });
        await route.fulfill({ json: { plan, tasks, mode: body.mode, source: "fallback", model: null, version: 1, plannedAt: "08:30" } });
      });
      await use();
    },
    { auto: true },
  ],
  user: [
    async ({ context, baseURL, page }, use) => {
      const user = await createUser({ onboarded: true });
      await signInAs(context, user, baseURL ?? "http://localhost:3100");
      await use(user);
      await page.goto("about:blank").catch(() => {}); // stop in-flight requests before the account is deleted
      await deleteCreatedUsers();
    },
    { auto: true },
  ],
});
export { expect };
