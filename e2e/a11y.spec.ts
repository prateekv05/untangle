import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openDump, setNow, toUnderstand, EXAMPLE } from "./helpers";

async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`), label).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test(`axe finds no serious issues on any screen, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await openDump(page);
    await axe(page, "dump empty");
    await page.getByRole("textbox", { name: "What's on your mind?" }).fill(EXAMPLE);
    await axe(page, "dump typed");
    await page.getByRole("button", { name: "Settings" }).click();
    await axe(page, "settings sheet");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "+ Yours" }).click();
    await axe(page, "presets sheet");
    await page.keyboard.press("Escape");
    await toUnderstand(page);
    await axe(page, "understand");
    await page.getByRole("button", { name: "Build my day" }).click();
    await page.getByRole("button", { name: "Re-plan my day" }).waitFor({ timeout: 15_000 });
    await axe(page, "plan");
    await page.getByTestId("block-gym").click();
    await axe(page, "plan expanded");
    await page.getByRole("button", { name: "Edit" }).click();
    await axe(page, "edit sheet");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Move later" }).click();
    await axe(page, "move sheet");
    await page.keyboard.press("Escape");
    await setNow(page, "11:45");
    await page.getByRole("button", { name: "Re-plan my day" }).click();
    await axe(page, "replan sheet");
    await page.getByRole("textbox", { name: "What changed?" }).fill("I didn't finish SQL and I have a meeting at 2.");
    await page.getByRole("button", { name: "Re-plan my day" }).last().click();
    await page.getByText("Re-planned at 11:45").waitFor();
    await axe(page, "replanned");
  });

  test(`axe on listening and gallery, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/?listen=24");
    await page.getByRole("button", { name: "Tap to talk" }).click();
    await page.getByText("Six things so far.").waitFor();
    await axe(page, "listening");
    await page.goto("/dev/gallery");
    await axe(page, "gallery");
  });
}
