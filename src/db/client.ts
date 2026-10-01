import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = ReturnType<typeof makeDb>;

export function makeDb(url: string) {
  return drizzle(neon(url), { schema });
}

let cached: Db | undefined;

// Lazy so `next build` and unit tests do not need DATABASE_URL.
export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
    cached = makeDb(url);
  }
  return cached;
}
