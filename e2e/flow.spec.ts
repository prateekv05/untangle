import { expect, test } from "./fixtures";
import { planDay } from "../src/lib/planner";
import { DEFAULT_SETTINGS } from "../src/lib/schemas";
import { exampleTasks } from "../src/fixtures/example";
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

test("tasks moved to today are offered on the Dump screen and added to the list", async ({ page }) => {
  const task = { id: "c1", title: "Buy toothpaste", location: "outside", kind: "errand", durationMin: 15, durationSource: "user", fixedStart: null, due: null };
  await page.route("**/api/day", (route) => route.fulfill({ json: { date: "2026-10-03", day: null, carried: [task] } }));
  await openDump(page);
  await expect(page.getByText("Carried over: Buy toothpaste.")).toBeVisible();
  await page.getByRole("button", { name: "Add Buy toothpaste" }).click();
  await expect(page.getByRole("textbox", { name: "What's on your mind?" })).toHaveValue(/Buy toothpaste/);
  await expect(page.getByText("Carried over: Buy toothpaste.")).toBeHidden();
});

test("today's saved day comes back on open, with finished and moved tasks as they were", async ({ page }) => {
  const tasks = exampleTasks();
  const plan = planDay(tasks, DEFAULT_SETTINGS, { mode: "dayoff" });
  const rows = tasks.map((t) => ({ ...t, status: t.id === "mom" ? "done" : t.id === "gym" ? "moved" : "open", movedTo: t.id === "gym" ? "2026-10-04" : null }));
  await page.route("**/api/day", (route) => route.fulfill({ json: { date: "2026-10-03", carried: [], day: { day: { id: "d1", mode: "dayoff" }, tasks: rows, plan: { version: 3, snapshot: plan, createdAt: "2026-10-03T08:30:00Z" } } } }));
  await page.goto("/?now=08:30");
  await expect(page.getByRole("button", { name: "Re-plan my day" }).first()).toBeVisible();
  await expect(page.getByTestId("block-mom")).toHaveAttribute("data-done", "true");
  await expect(page.getByText("Moved to a later day")).toBeVisible();
  await expect(page.getByText("Oct 4")).toBeVisible();
});

test("start a new dump from the plan asks first, then opens an empty Dump screen", async ({ page }) => {
  await toPlan(page);
  await page.getByRole("button", { name: "Start a new dump" }).click();
  await page.getByRole("button", { name: "Keep my plan" }).click();
  await expect(page.getByRole("button", { name: "Re-plan my day" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Start a new dump" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start a new dump" }).click();
  await expect(page.getByRole("heading", { name: "What's on your mind?" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "What's on your mind?" })).toHaveValue("");
});
