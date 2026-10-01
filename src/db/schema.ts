/**
 * Neon (serverless Postgres) schema via Drizzle.
 * Driver: @neondatabase/serverless + drizzle-orm/neon-http. Migrations: drizzle-kit.
 * Identity: sign-up with Google is required (Auth.js, Phase 3). Every user row is a Google account; there are no anonymous users.
 */
import { date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Plan } from "../lib/schemas";

export const locationEnum = pgEnum("location", ["home", "work", "outside", "anywhere"]);
export const kindEnum = pgEnum("kind", ["deep", "admin", "errand", "call", "health", "chore", "fixed"]);
export const dueEnum = pgEnum("due", ["today", "tomorrow", "week", "none"]);
export const durationSourceEnum = pgEnum("duration_source", ["user", "preset", "estimated"]);
export const taskStatusEnum = pgEnum("task_status", ["open", "done", "moved", "deleted"]);
export const dayModeEnum = pgEnum("day_mode", ["workday", "dayoff"]);
export const planTriggerEnum = pgEnum("plan_trigger", ["initial", "replan", "edit"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // from Google
  googleSub: text("google_sub").notNull().unique(), // Google account id
  passwordHash: text("password_hash"), // optional, set from Settings after Google sign-in; scrypt "salt:hash". null = Google-only
  name: text("name"), // from onboarding (Phase 3); prefilled from Google
  gender: text("gender"), // optional, from onboarding: "woman" | "man" | "non_binary" | "prefer_not_to_say". Never sent to the AI.
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }), // null = show onboarding
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  workStart: text("work_start").notNull().default("09:00"),
  workEnd: text("work_end").notNull().default("17:00"),
  workDays: integer("work_days").array().notNull().default([1, 2, 3, 4, 5]), // 0 = Sunday
  wake: text("wake").notNull().default("07:00"),
  sleep: text("sleep").notNull().default("23:00"),
  timezone: text("timezone").notNull().default("UTC"),
});

/** A preset is a first word that sets location, kind and (optionally) duration. null duration = ask the user. */
export const presets = pgTable("presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  verb: text("verb").notNull(),
  location: locationEnum("location").notNull(),
  kind: kindEnum("kind").notNull(),
  defaultDurationMin: integer("default_duration_min"),
}, (t) => [uniqueIndex("presets_user_verb").on(t.userId, t.verb)]);

/** One row per planned day. */
export const days = pgTable("days", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(), // the day being planned, in the user's timezone
  mode: dayModeEnum("mode").notNull(),
  rawDump: text("raw_dump").notNull().default(""), // typed text or voice transcript. Audio is never stored.
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("days_user_date").on(t.userId, t.date)]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  dayId: uuid("day_id").notNull().references(() => days.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  location: locationEnum("location").notNull(),
  kind: kindEnum("kind").notNull(),
  durationMin: integer("duration_min").notNull(),
  durationSource: durationSourceEnum("duration_source").notNull(),
  fixedStart: text("fixed_start"), // "HH:MM" or null
  due: dueEnum("due"),
  status: taskStatusEnum("status").notNull().default("open"),
  movedTo: date("moved_to", { mode: "string" }), // when status = moved
  position: integer("position").notNull().default(0), // original order in the dump
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("tasks_day").on(t.dayId)]);

/** Every plan version is kept: initial, then each re-plan. The latest version is current. */
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  dayId: uuid("day_id").notNull().references(() => days.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  trigger: planTriggerEnum("trigger").notNull(),
  instruction: text("instruction"), // the user's re-plan words
  snapshot: jsonb("snapshot").$type<Plan>().notNull(), // validated Plan (src/lib/schemas.ts)
  source: text("source").notNull().default("llm"), // "llm" | "fallback"
  model: text("model"), // "provider:model-id" that produced this plan; null when source = "fallback"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("plans_day_version").on(t.dayId, t.version)]);

/** Cheap abuse and cost control: AI calls per user per day. */
export const aiUsage = pgTable("ai_usage", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: date("day", { mode: "string" }).notNull(),
  calls: integer("calls").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.day] })]);

/** Sign-in rate limiting: attempts per key ("ip:1.2.3.4", "email:a@b.c") per fixed time window. */
export const authAttempts = pgTable("auth_attempts", {
  key: text("key").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.key, t.windowStart] })]);
