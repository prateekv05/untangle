import type { Page } from "@playwright/test";

export const EXAMPLE = "SQL assignment, gym, groceries, call Mom, send resume to Sarah, work on my app, buy toothpaste";

export async function openDump(page: Page, query = "demo=1&now=08:30") {
  await page.goto(`/?${query}`);
  await page.getByRole("heading", { name: "What's on your mind?" }).waitFor();
}

export async function toUnderstand(page: Page, text = EXAMPLE) {
  await page.getByRole("textbox", { name: "What's on your mind?" }).fill(text);
  await page.getByRole("button", { name: "Untangle my day" }).click();
  await page.getByRole("heading", { name: "Here's what I understood" }).waitFor({ timeout: 15_000 });
}

export async function toPlan(page: Page, text = EXAMPLE) {
  await openDump(page);
  await toUnderstand(page, text);
  await page.getByRole("button", { name: "Build my day" }).click();
  await page.getByRole("button", { name: "Re-plan my day" }).waitFor({ timeout: 15_000 });
}

/** The URL's ?now= drives the app clock. */
export async function setNow(page: Page, hhmm: string) {
  await page.evaluate((t) => { const u = new URL(location.href); u.searchParams.set("now", t); history.replaceState(null, "", u); }, hhmm);
}
