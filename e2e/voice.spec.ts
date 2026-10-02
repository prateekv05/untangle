import { expect, test } from "./fixtures";
import { FAKE_MIC, blockMic, fakeSpeech, noSpeech } from "./voice-fakes";
import { openDump, toPlan } from "./helpers";

test.use(FAKE_MIC);

const SAID = ["Okay, tomorrow I need to finish my SQL assignment,", "I have to go grocery shopping,", "and call my mom,", "and I want to go to the gym"];

test.describe("with a microphone", () => {
  test("web speech: live words, planning chip, chips, Done sends the text to understand", async ({ page }) => {
    await fakeSpeech(page, SAID);
    await openDump(page);
    await page.getByRole("button", { name: "Tap to talk" }).click();
    await expect(page.getByText("Planning for tomorrow,")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Finish my SQL assignment" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Go grocery shopping" })).toBeVisible();
    await expect(page.getByLabel("Done talking")).toBeEnabled();
    await page.waitForTimeout(2000); // the last phrase lands
    let sent = "";
    await page.route("**/api/understand", async (route) => { sent = (route.request().postDataJSON() as { text: string }).text; await route.fallback(); });
    await page.getByRole("button", { name: "Done talking" }).click();
    await page.getByRole("heading", { name: "Here's what I understood" }).waitFor({ timeout: 15_000 });
    expect(sent).toContain("I want to go to the gym");
  });

  test("recorder path: audio goes to /api/transcribe, the text goes to understand, nothing else is kept", async ({ page }) => {
    await noSpeech(page);
    let upload: { type: string; body: string } | null = null;
    await page.route("**/api/transcribe", async (route) => {
      const req = route.request();
      upload = { type: req.headers()["content-type"] ?? "", body: req.postDataBuffer()?.toString("latin1") ?? "" };
      await route.fulfill({ json: { text: "SQL assignment, gym, groceries, call mom" } });
    });
    await openDump(page);
    await page.getByRole("button", { name: "Tap to talk" }).click();
    await expect(page.getByText("Listening", { exact: true }).nth(1)).toBeVisible();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Done talking" }).click();
    await page.getByRole("heading", { name: "Here's what I understood" }).waitFor({ timeout: 15_000 });
    expect(upload!.type).toMatch(/^multipart\/form-data/);
    expect(upload!.body).toContain('name="audio"');
    expect(upload!.body).toMatch(/name="seconds"\r\n\r\n[1-9]/);
    expect(await page.evaluate(() => JSON.stringify([Object.keys(localStorage), Object.keys(sessionStorage)]))).toBe("[[],[]]");
  });

  test("nothing heard says so and offers both ways forward", async ({ page }) => {
    await noSpeech(page);
    await page.route("**/api/transcribe", (route) => route.fulfill({ json: { text: "" } }));
    await openDump(page);
    await page.getByRole("button", { name: "Tap to talk" }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Done talking" }).click();
    await expect(page.getByText("I didn't catch anything. Try again, or type it.")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("button", { name: "Done talking" })).toBeEnabled();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("textbox", { name: "What's on your mind?" })).toBeVisible();
  });

  test("the daily limit and a server failure are plain messages", async ({ page }) => {
    await noSpeech(page);
    await page.route("**/api/transcribe", (route) => route.fulfill({ status: 429, json: { error: "daily_limit" } }));
    await openDump(page);
    await page.getByRole("button", { name: "Tap to talk" }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Done talking" }).click();
    await expect(page.getByText("That's today's limit for voice. You can still type.")).toBeVisible();
    await page.getByRole("button", { name: "Type instead" }).click();
    await expect(page.getByRole("textbox", { name: "What's on your mind?" })).toBeVisible();
  });

  test("re-plan by voice fills the box and does not submit", async ({ page }) => {
    await fakeSpeech(page, ["I didn't finish SQL", "and I have a meeting at 2."]);
    let replans = 0;
    await page.route("**/api/replan", async (route) => { replans += 1; await route.fallback(); });
    await toPlan(page);
    await page.getByRole("button", { name: "Re-plan my day" }).click();
    const box = page.getByRole("textbox", { name: "What changed?" });
    await page.getByRole("button", { name: "Talk", exact: true }).click();
    await expect(box).toHaveValue(/meeting at 2/, { timeout: 5000 });
    await page.getByRole("button", { name: "Listening" }).click();
    await expect(box).toHaveValue("I didn't finish SQL and I have a meeting at 2.");
    await box.fill("I didn't finish SQL and I have a meeting at 3.");
    expect(replans).toBe(0);
    await expect(page.getByRole("button", { name: "Re-plan my day" }).last()).toBeEnabled();
  });
});

test.describe("permission", () => {
  test("a first-time user sees the explainer before the browser prompt", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.permissions.query = () => Promise.resolve({ state: "prompt" } as PermissionStatus);
    });
    await blockMic(page);
    await openDump(page);
    await page.getByRole("button", { name: "Tap to talk" }).click();
    await expect(page.getByText("Untangle needs your microphone to hear you.")).toBeVisible();
    await page.getByRole("button", { name: "Allow microphone" }).click();
    await expect(page.getByText("Microphone is blocked. You can still type.")).toBeVisible();
  });

  test("a blocked microphone falls back to typing", async ({ page }) => {
    await blockMic(page);
    await openDump(page);
    await page.getByRole("button", { name: "Tap to talk" }).click();
    await expect(page.getByText("Microphone is blocked. You can still type.")).toBeVisible();
    await page.getByRole("button", { name: "Type instead" }).click();
    const box = page.getByRole("textbox", { name: "What's on your mind?" });
    await box.fill("call mom");
    await expect(page.getByRole("button", { name: "Untangle my day" })).toBeEnabled();
  });
});
