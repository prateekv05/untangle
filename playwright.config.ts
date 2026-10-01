import { defineConfig } from "@playwright/test";

try { process.loadEnvFile(".env.local"); } catch { /* CI sets the variables directly */ }

const PORT = 3100;
const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error("TEST_DATABASE_URL is required: e2e creates and deletes accounts, so it never runs against the dev database.");

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  webServer: { command: `npx next dev --webpack -p ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: false, timeout: 120_000, env: { DATABASE_URL: testDb, NEXT_DIST_DIR: ".next-e2e" } },
});
