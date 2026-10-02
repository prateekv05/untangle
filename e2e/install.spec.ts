import { expect, test } from "./fixtures";
import { toPlan } from "./helpers";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("Chromium: the hint offers the browser's install prompt, once", async ({ page }) => {
  await toPlan(page);
  await expect(page.getByRole("region", { name: "Add to home screen" })).toHaveCount(0); // no prompt to offer yet
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => { (window as unknown as { __prompted: boolean }).__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
  const hint = page.getByRole("region", { name: "Add to home screen" });
  await expect(hint).toBeVisible();
  await hint.getByRole("button", { name: "Add to home screen" }).click();
  expect(await page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
  await expect(hint).toBeHidden(); // the prompt is single-use
});

test("dismissing the hint is remembered", async ({ page }) => {
  await toPlan(page);
  const fire = () => page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => {};
    e.userChoice = new Promise(() => {});
    window.dispatchEvent(e);
  });
  await fire();
  const hint = page.getByRole("region", { name: "Add to home screen" });
  await hint.getByRole("button", { name: "Not now" }).click();
  await expect(hint).toBeHidden();
  await page.evaluate(() => localStorage.getItem("untangle-install-dismissed")).then((v) => expect(v).toBe("1"));
  await fire();
  await expect(hint).toBeHidden();
});

test.describe("iPhone", () => {
  test.use({ userAgent: IPHONE });
  test("shows the Add to Home Screen steps", async ({ page }) => {
    await toPlan(page);
    const hint = page.getByRole("region", { name: "Add to home screen" });
    await expect(hint).toContainText("Choose Add to Home Screen.");
    await expect(hint.getByRole("button", { name: "Add to home screen" })).toHaveCount(0);
    await hint.getByRole("button", { name: "Got it" }).click();
    await expect(hint).toBeHidden();
  });
});
