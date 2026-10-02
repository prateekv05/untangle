import { test } from "./fixtures";
import { mkdirSync } from "node:fs";
import { openDump, setNow, EXAMPLE } from "./helpers";
import { FAKE_MIC, fakeSpeech } from "./voice-fakes";

test.use(FAKE_MIC);

const OUT = process.env.SHOT_DIR ?? "test-results/screens";
mkdirSync(OUT, { recursive: true });

for (const scheme of ["light", "dark"] as const) {
  test(`screenshots, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const shot = (name: string, fullPage = true) => page.screenshot({ path: `${OUT}/${name}-${scheme}.png`, fullPage });

    await openDump(page);
    await shot("01-dump-empty");
    await page.getByRole("textbox", { name: "What's on your mind?" }).fill(EXAMPLE);
    await shot("01-dump-typed");

    await page.getByRole("button", { name: "Untangle my day" }).click();
    await page.waitForTimeout(900);
    await shot("03-thinking-dump");
    await page.getByRole("heading", { name: "Here's what I understood" }).waitFor({ timeout: 15_000 });
    await shot("04-understand");

    await page.getByRole("button", { name: "Build my day" }).click();
    await page.waitForTimeout(1500);
    await shot("05-thinking-plan");
    await page.getByRole("button", { name: "Re-plan my day" }).waitFor({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await shot("06-plan");

    await page.getByTestId("block-gym").click();
    await shot("07-plan-expanded");
    await page.getByRole("button", { name: "Edit" }).click();
    await shot("08-edit-sheet", false);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Move later" }).click();
    await shot("09-move-sheet", false);
    await page.getByRole("button", { name: "Tomorrow" }).click();
    await shot("10-moved-toast");

    await page.getByRole("checkbox", { name: /Finish Send resume/ }).click();
    await shot("11-plan-finished");

    await setNow(page, "11:45");
    await page.getByRole("button", { name: "Re-plan my day" }).click();
    await page.getByRole("textbox", { name: "What changed?" }).fill("I didn't finish SQL and I have a meeting at 2.");
    await shot("12-replan-sheet", false);
    await page.getByRole("button", { name: "Re-plan my day" }).last().click();
    await page.getByText("Re-planned at 11:45").waitFor();
    await shot("13-replanned");

    await page.getByRole("button", { name: "Settings" }).click();
    await shot("14-settings", false);
    await page.getByRole("button", { name: /Presets/ }).click();
    await shot("15-presets", false);
  });

  test(`listening and gallery, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await fakeSpeech(page, ["Okay, tomorrow I need to finish my SQL assignment,", "I have to go grocery shopping,", "I need to call my mom,", "I want to go to the gym,", "I need to send Sarah my resume,", "and I really need to spend some time on my app"]);
    await page.goto("/?demo=1");
    await page.getByRole("button", { name: "Tap to talk" }).click();
    await page.getByText("Five things so far.").waitFor();
    await page.screenshot({ path: `${OUT}/02-listening-${scheme}.png` });
  });
}
