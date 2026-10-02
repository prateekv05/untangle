/**
 * Lighthouse (mobile, default throttling) on the Dump and Plan screens of a production build, signed in as throwaway test accounts.
 *
 *   NEXT_DIST_DIR=.next-pwa npm run build
 *   DATABASE_URL=$TEST_DATABASE_URL NEXT_DIST_DIR=.next-pwa AUTH_TRUST_HOST=true npx next start -p 3101
 *   npm run lighthouse            # LH_URL=http://localhost:3101 by default
 *
 * Lighthouse is fetched with npx and not added as a dependency. Version 12 and later have no PWA category, so installability
 * is covered by the production e2e (npm run e2e:pwa): manifest, icons, service worker, plan open offline.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { makeDb } from "../src/db/client";
import { createDayWithTasks, getSettings, savePlan } from "../src/db/queries";
import { fixtureTasksFor } from "../src/fixtures/example";
import { planDay } from "../src/lib/planner";
import { DEFAULT_SETTINGS } from "../src/lib/schemas";
import { localClock } from "../src/lib/timezone";
import { createUser, deleteCreatedUsers, sessionCookieValue } from "../e2e/support";
import { EXAMPLE } from "../e2e/helpers";

const URL_BASE = process.env.LH_URL ?? "http://localhost:3101";
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is required (accounts are created and deleted).");

async function run(label: string, cookie: string) {
  const out = join(mkdtempSync(join(tmpdir(), "lh-")), "r.json");
  execFileSync("npx", [
    "--yes", "lighthouse@13", `${URL_BASE}/`,
    "--quiet", "--output=json", `--output-path=${out}`,
    "--only-categories=performance,accessibility,best-practices",
    "--chrome-flags=--headless=new --no-sandbox",
    `--extra-headers=${JSON.stringify({ Cookie: `authjs.session-token=${cookie}` })}`,
  ], { stdio: "inherit", env: { ...process.env, CHROME_PATH: chromium.executablePath() } });
  const r = JSON.parse(readFileSync(out, "utf8"));
  const score = (id: string) => Math.round(r.categories[id].score * 100);
  const m = (id: string) => r.audits[id].displayValue;
  console.log(`${label.padEnd(5)} performance ${score("performance")}  accessibility ${score("accessibility")}  best-practices ${score("best-practices")}  | FCP ${m("first-contentful-paint")}  LCP ${m("largest-contentful-paint")}  TBT ${m("total-blocking-time")}  CLS ${m("cumulative-layout-shift")}  final URL ${r.finalDisplayedUrl}`);
}

try {
  const dumpUser = await createUser({ onboarded: true });
  const planUser = await createUser({ onboarded: true });
  const db = makeDb(url);
  const date = localClock((await getSettings(planUser.id, db)).timezone).date;
  const fixtures = (fixtureTasksFor(EXAMPLE) ?? []).map(({ id: _id, ...t }) => t);
  const { day, tasks } = await createDayWithTasks(planUser.id, date, "workday", EXAMPLE, fixtures, db);
  await savePlan(planUser.id, day.id, "initial", null, planDay(tasks, DEFAULT_SETTINGS, { mode: "workday" }), "fallback", null, db);
  await run("Dump", await sessionCookieValue(dumpUser));
  await run("Plan", await sessionCookieValue(planUser));
} finally {
  await deleteCreatedUsers();
}
