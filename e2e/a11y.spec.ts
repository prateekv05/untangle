import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { openDump, setNow, toPlan, toUnderstand, EXAMPLE } from "./helpers";
import { FAKE_MIC, fakeSpeech } from "./voice-fakes";

test.use(FAKE_MIC);

/** Every visible button, link and field is at least 44 px each way (a link inside running text is exempt, as in WCAG 2.5.8). */
async function targets(page: Page, label: string) {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("button, a[href], input:not([type=hidden]), select, textarea, [role=checkbox], [role=radio], [role=switch], [role=tab]")) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === "hidden" || el.closest("[aria-hidden=true], [hidden], .sr-only")) continue;
      if (el.matches("a") && el.closest("p, li") && style.display === "inline") continue;
      // A wide 44 px-tall row is fine; so is a 44 px square. A label wrapping a small input counts as the target.
      if (el.matches("input") && el.closest("label")) continue;
      // A control may keep a compact look and still have a 44 px hit area drawn by an absolutely positioned ::after.
      const after = getComputedStyle(el, "::after");
      const hit = after.position === "absolute" ? { w: parseFloat(after.width) || 0, h: parseFloat(after.height) || 0 } : { w: 0, h: 0 };
      if (Math.max(r.height, hit.h) < 43.5 || Math.max(r.width, hit.w) < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  expect(small.map((s) => `${label}: ${s}`), `${label}: touch targets under 44 px`).toEqual([]);
}

async function axe(page: Page, label: string, opts: { sizes?: boolean } = {}) {
  if (opts.sizes !== false) await targets(page, label);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`), label).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test(`axe finds no serious issues on any screen, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("untangle-theme", "system")); // the app defaults to light: follow the emulated scheme instead
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
    await page.addInitScript(() => localStorage.setItem("untangle-theme", "system")); // the app defaults to light: follow the emulated scheme instead
    await fakeSpeech(page, ["Okay, tomorrow I need to finish my SQL assignment,", "I have to go grocery shopping,", "and call my mom,"]);
    await page.goto("/");
    await page.getByRole("button", { name: "Tap to talk" }).click();
    await page.getByRole("status").filter({ hasText: "Listening" }).waitFor();
    await axe(page, "listening");
    await page.goto("/dev/gallery");
    await axe(page, "gallery", { sizes: false }); // a dev-only page that shows components at every size
  });
}

test("every control shows a visible focus ring on the Dump and Plan screens", async ({ page }) => {
  const ringless = async (label: string) => {
    const bad: string[] = [];
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || el.matches("textarea, input, nextjs-portal")) return null; // fields draw their ring on the wrapping card
        const s = getComputedStyle(el);
        return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2 ? null : `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`;
      });
      if (r) bad.push(r);
    }
    expect(bad, `${label}: controls without a focus ring`).toEqual([]);
  };
  await openDump(page);
  await ringless("dump");
  await toPlan(page);
  await ringless("plan");
});

test("the offline note and the install hint pass axe and the target size, both themes", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("untangle-theme", "system")); // the app defaults to light: follow the emulated scheme instead
    await toPlan(page);
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };
      e.prompt = async () => {};
      e.userChoice = new Promise(() => {});
      window.dispatchEvent(e);
    });
    await page.getByRole("region", { name: "Add to home screen" }).waitFor();
    await axe(page, `install hint ${scheme}`);
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.getByText("You're offline.").waitFor();
    await axe(page, `offline ${scheme}`);
    await page.context().setOffline(false);
  }
});
