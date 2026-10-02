import { test as base, expect } from "@playwright/test";
import { fixtureTasksFor } from "../src/fixtures/example";
import { deriveQuestions, tasksFromText } from "../src/lib/guess";
import { createUser, deleteCreatedUsers, signInAs, type TestUser } from "./support";

/** `test` with a signed-in, onboarded account (no name, so headings read "What's on your mind?"). */
export const test = base.extend<{ user: TestUser; understandStub: void }>({
  // The screens tests exercise the UI, not the model: /api/understand answers from the Phase 1 fixtures. The real route has its own tests.
  understandStub: [
    async ({ page }, use) => {
      await page.route("**/api/understand", async (route) => {
        const { text } = route.request().postDataJSON() as { text: string };
        const tasks = fixtureTasksFor(text) ?? tasksFromText(text, []);
        await route.fulfill({ json: { dayId: "stub", date: "2026-10-03", mode: "workday", planFor: "today", tasks, questions: deriveQuestions(tasks), groupings: [], model: "stub" } });
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
