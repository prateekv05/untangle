import { defineConfig } from "@playwright/test";

try { process.loadEnvFile(".env.local"); } catch { /* CI sets the variables directly */ }

// The service worker only exists in a production build, so the PWA checks run against `next build` + `next start`, not the dev server.
const PORT = 3101;
const testDb = process.env.TEST_DATABASE_URL;
if (!testDb) throw new Error("TEST_DATABASE_URL is required: these tests create and delete accounts, so they never run against the dev database.");

export default defineConfig({
  testDir: "e2e-pwa",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/manifest.webmanifest`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { DATABASE_URL: testDb, NEXT_DIST_DIR: ".next-pwa", AUTH_TRUST_HOST: "true" },
  },
});
