import { expect, test } from "@playwright/test";
import { createUser, deleteCreatedUsers, signInAs } from "./support";

test.afterAll(deleteCreatedUsers);

const dumpHeading = (page: import("@playwright/test").Page, name?: string) =>
  page.getByRole("heading", { name: name ? `What's on your mind, ${name}?` : "What's on your mind?" });

test("signed out, every page is the Welcome screen", async ({ page }) => {
  for (const path of ["/", "/welcome/name", "/welcome/replan", "/?demo=1"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Untangle my day" })).toHaveCount(0);
});

test.describe("onboarding timezone", () => { test.use({ timezoneId: "Asia/Tokyo" }); test("a new account is onboarded once, then lands on Dump with its name; its zone is saved", async ({ page, context, baseURL }) => {
  const user = await createUser({ onboarded: false });
  await signInAs(context, user, baseURL!);

  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome\/name$/); // not onboarded: the app is out of reach
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/welcome\/name$/);

  await page.getByLabel("Your name").fill("Sam");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "How do you identify?" })).toBeVisible();
  await page.getByRole("radio", { name: "Non-binary" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Say everything on your mind." })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Get a day you can actually do." })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "When life changes, just say so." })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(dumpHeading(page, "Sam")).toBeVisible();

  // Onboarding does not come back, and neither does Welcome.
  await page.goto("/welcome/name");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/$/);
  await expect(dumpHeading(page, "Sam")).toBeVisible();
  const settings = await (await page.request.get("/api/settings")).json();
  expect(settings.timezone).toBe("Asia/Tokyo"); // saved once by onboarding, not guessed later
}); });

test("a returning account goes straight to Dump on a second browser", async ({ browser, baseURL }) => {
  const user = await createUser({ onboarded: true, name: "Alex" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await signInAs(context, user, baseURL!);
  const page = await context.newPage();
  await page.goto("/");
  await expect(dumpHeading(page, "Alex")).toBeVisible();
  await context.close();
});

test("settings and presets are saved to the account and survive a fresh browser", async ({ browser, baseURL }) => {
  const user = await createUser({ onboarded: true });
  const open = async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await signInAs(context, user, baseURL!);
    const page = await context.newPage();
    // The account's settings load after first paint; wait for them so the test does not race the cold dev compile.
    const loaded = page.waitForResponse((r) => r.url().endsWith("/api/settings") && r.request().method() === "GET");
    await page.goto("/");
    await expect(dumpHeading(page)).toBeVisible();
    await loaded;
    return { context, page };
  };

  const first = await open();
  await first.page.getByRole("button", { name: "Settings" }).click();
  const dialog = first.page.getByRole("dialog", { name: "Settings" });
  await dialog.getByLabel("Work starts").fill("08:30");
  await dialog.getByRole("button", { name: "Saturday" }).click();
  const saved = first.page.waitForResponse((r) => r.url().endsWith("/api/settings") && r.request().method() === "PUT");
  await dialog.getByRole("button", { name: "Save" }).click();
  expect((await saved).status()).toBe(200);

  await first.page.getByRole("button", { name: "Settings" }).click();
  await first.page.getByRole("button", { name: /^Presets/ }).click();
  const presets = first.page.getByRole("dialog", { name: "Presets" });
  await presets.getByLabel("Word or phrase").fill("Swim");
  const posted = first.page.waitForResponse((r) => r.url().endsWith("/api/presets") && r.request().method() === "POST");
  await presets.getByRole("button", { name: "Add preset" }).click();
  expect((await posted).status()).toBe(201);
  await expect(presets.getByText("Swim")).toBeVisible();
  await first.context.close();

  const second = await open();
  await second.page.getByRole("button", { name: "Settings" }).click();
  const d2 = second.page.getByRole("dialog", { name: "Settings" });
  await expect(d2.getByLabel("Work starts")).toHaveValue("08:30");
  await expect(d2.getByRole("button", { name: "Saturday" })).toHaveAttribute("aria-pressed", "true");
  await d2.getByRole("button", { name: /^Presets/ }).click();
  const p2 = second.page.getByRole("dialog", { name: "Presets" });
  await expect(p2.getByText("Swim")).toBeVisible();

  const removed = second.page.waitForResponse((r) => r.url().includes("/api/presets/") && r.request().method() === "DELETE");
  await p2.getByRole("button", { name: "Delete Swim" }).click();
  expect((await removed).status()).toBe(204);
  await second.context.close();
});

test("a failed save puts the setting back and says so", async ({ page, context, baseURL }) => {
  const user = await createUser({ onboarded: true });
  await signInAs(context, user, baseURL!);
  await page.goto("/");
  await expect(dumpHeading(page)).toBeVisible();
  await page.route("**/api/settings", (route) => (route.request().method() === "PUT" ? route.fulfill({ status: 500, json: { error: "server_error" } }) : route.continue()));

  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByLabel("Work starts").fill("06:00");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("I couldn't save your settings")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" }).getByLabel("Work starts")).toHaveValue("09:00");
});

test("when settings fail to load, Settings offers a retry and no form to save defaults with", async ({ page, context, baseURL }) => {
  const user = await createUser({ onboarded: true });
  await signInAs(context, user, baseURL!);
  let fail = true;
  await page.route("**/api/settings", (route) => (fail && route.request().method() === "GET" ? route.fulfill({ status: 500, json: { error: "server_error" } }) : route.continue()));
  await page.goto("/");
  await expect(dumpHeading(page)).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog.getByText("I couldn't load your settings")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Sign out" })).toBeVisible();

  fail = false;
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByLabel("Work starts")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save" })).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`Welcome and onboarding: axe finds no serious issues, screenshots at 390px, ${scheme}`, async ({ page, context, baseURL }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    const out = process.env.SHOT_DIR ?? "test-results/screens";
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const check = async (label: string) => {
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${label}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`), label).toEqual([]);
      await page.screenshot({ path: `${out}/${label}-${scheme}.png`, fullPage: true });
    };

    await page.goto("/welcome");
    await page.getByRole("button", { name: "Continue with Google" }).waitFor();
    await check("08-welcome");
    await page.getByRole("button", { name: /Sign in with a password/ }).click();
    await page.getByLabel("Email").waitFor();
    await check("08-welcome-password");

    const user = await createUser({ onboarded: false });
    await signInAs(context, user, baseURL!);
    for (const [path, heading] of [["name", "What should I call you?"], ["gender", "How do you identify?"], ["dump", "Say everything on your mind."], ["plan", "Get a day you can actually do."], ["replan", "When life changes, just say so."]] as const) {
      await page.goto(`/welcome/${path}`);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await check(`09-onboarding-${path}`);
    }
  });
}
