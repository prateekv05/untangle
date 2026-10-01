import { test as base, expect } from "@playwright/test";
import { createUser, deleteCreatedUsers, signInAs, type TestUser } from "./support";

/** `test` with a signed-in, onboarded account (no name, so headings read "What's on your mind?"). */
export const test = base.extend<{ user: TestUser }>({
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
