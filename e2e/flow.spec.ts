import { expect, test } from "./fixtures";
import { openDump, setNow, toPlan, toUnderstand, EXAMPLE } from "./helpers";

test("keyboard-only walkthrough from dump to re-planned", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openDump(page);
  await page.getByRole("textbox", { name: "What's on your mind?" }).focus();
  await page.keyboard.type(EXAMPLE);
  await page.getByRole("button", { name: "Untangle my day" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Here's what I understood" }).waitFor({ timeout: 15_000 });
  // answer a question with the keyboard
  await page.getByRole("button", { name: "Tomorrow" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("One quick question")).toBeVisible();
  await page.getByRole("button", { name: "Build my day" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Re-plan my day" }).waitFor({ timeout: 15_000 });
  // expand a block with the keyboard and finish it
  await page.getByRole("button", { name: /^Call mom/ }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Finished" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("block-mom")).toHaveAttribute("data-done", "true");
  await page.getByRole("button", { name: "Undo" }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("block-mom")).not.toHaveAttribute("data-done", "true");
});

test("sheets trap focus and close on Escape, returning focus", async ({ page }) => {
  await openDump(page);
  const settings = page.getByRole("button", { name: "Settings" });
  await settings.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(settings).toBeFocused();
});

test("move later shows a toast, undo restores the task, bring back works", async ({ page }) => {
  await toPlan(page);
  await page.getByTestId("block-gym").click();
  await page.getByRole("button", { name: "Move later" }).click();
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Gym moved to Tomorrow" })).toBeVisible();
  await expect(page.getByTestId("block-gym")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("block-gym")).toBeVisible();
  await page.getByTestId("block-gym").click();
  await page.getByRole("button", { name: "Move later" }).click();
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await page.getByRole("button", { name: "Bring back" }).click();
  await expect(page.getByTestId("block-gym")).toBeVisible();
});

test("edit sheet re-plans, add task and mode toggle work", async ({ page }) => {
  await openDump(page);
  await toUnderstand(page);
  await page.getByRole("radio", { name: "Day off" }).click();
  await expect(page.getByRole("radio", { name: "Day off" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "+ Forgot something? Add it" }).click();
  await page.getByLabel("What is it?").fill("Water the plants");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByTestId(/^row-n/)).toHaveCount(1);
  await page.getByRole("button", { name: "Build my day" }).click();
  await page.getByRole("button", { name: "Re-plan my day" }).waitFor({ timeout: 15_000 });
  await page.getByTestId("block-gym").click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("How long").selectOption("90");
  await page.getByRole("button", { name: "Save and re-plan" }).click();
  await expect(page.getByTestId("block-gym")).toContainText("1 h 30 min");
});

test("re-plan keeps finished tasks and an unrecognised request leaves the plan unchanged", async ({ page }) => {
  await toPlan(page);
  await page.getByRole("checkbox", { name: /Finish Send resume/ }).click();
  await setNow(page, "11:45");
  await page.getByRole("button", { name: "Re-plan my day" }).click();
  await expect(page.getByRole("button", { name: "Re-plan my day" }).last()).toBeDisabled();
  await page.getByRole("textbox", { name: "What changed?" }).fill("hmm");
  await page.getByRole("button", { name: "Re-plan my day" }).last().click();
  await expect(page.getByText("I couldn't rebuild that. Your plan is unchanged.")).toBeVisible();
  await page.getByRole("button", { name: "Re-plan my day" }).click();
  await page.getByRole("button", { name: "Lighter afternoon" }).click();
  await page.getByRole("button", { name: "Re-plan my day" }).last().click();
  await expect(page.getByRole("heading", { name: "Re-planned at 11:45" })).toBeVisible();
  await expect(page.getByTestId("block-res")).toHaveAttribute("data-done", "true");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { name: /Thursday|Friday|Saturday|Sunday|Monday|Tuesday|Wednesday/ })).toBeVisible();
});

test("theme toggle in settings switches data-theme", async ({ page }) => {
  await openDump(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("plan entrance: blocks arrive staggered, reduced motion shows the final state", async ({ page }) => {
  await openDump(page);
  await toUnderstand(page);
  await page.getByRole("button", { name: "Build my day" }).click();
  await page.getByRole("button", { name: "Re-plan my day" }).waitFor({ timeout: 15_000 });
  await expect(page.getByTestId("timeline")).toHaveClass(/enter/);
  const delays = await page.locator(".row-card").evaluateAll((els) => els.slice(0, 3).map((e) => getComputedStyle(e).animationDelay));
  expect(delays).toEqual(["0s", "0.18s", "0.36s"]);
  await page.getByTestId("block-sql").click();
  await expect(page.getByTestId("timeline")).not.toHaveClass(/enter/);
});
