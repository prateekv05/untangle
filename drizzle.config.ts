import { defineConfig } from "drizzle-kit";

try { process.loadEnvFile(".env.local"); } catch { /* CI sets env directly */ }

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.MIGRATE_URL ?? process.env.DATABASE_URL ?? "" },
});
