CREATE TYPE "public"."day_mode" AS ENUM('workday', 'dayoff');--> statement-breakpoint
CREATE TYPE "public"."due" AS ENUM('today', 'tomorrow', 'week', 'none');--> statement-breakpoint
CREATE TYPE "public"."duration_source" AS ENUM('user', 'preset', 'estimated');--> statement-breakpoint
CREATE TYPE "public"."kind" AS ENUM('deep', 'admin', 'errand', 'call', 'health', 'chore', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."location" AS ENUM('home', 'work', 'outside', 'anywhere');--> statement-breakpoint
CREATE TYPE "public"."plan_trigger" AS ENUM('initial', 'replan', 'edit');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'done', 'moved', 'deleted');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"mode" "day_mode" NOT NULL,
	"raw_dump" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"trigger" "plan_trigger" NOT NULL,
	"instruction" text,
	"snapshot" jsonb NOT NULL,
	"source" text DEFAULT 'llm' NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"verb" text NOT NULL,
	"location" "location" NOT NULL,
	"kind" "kind" NOT NULL,
	"default_duration_min" integer
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"work_start" text DEFAULT '09:00' NOT NULL,
	"work_end" text DEFAULT '17:00' NOT NULL,
	"work_days" integer[] DEFAULT '{1,2,3,4,5}' NOT NULL,
	"wake" text DEFAULT '07:00' NOT NULL,
	"sleep" text DEFAULT '23:00' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_id" uuid NOT NULL,
	"title" text NOT NULL,
	"location" "location" NOT NULL,
	"kind" "kind" NOT NULL,
	"duration_min" integer NOT NULL,
	"duration_source" "duration_source" NOT NULL,
	"fixed_start" text,
	"due" "due",
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"moved_to" date,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"google_sub" text NOT NULL,
	"password_hash" text,
	"name" text,
	"gender" text,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presets" ADD CONSTRAINT "presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "days_user_date" ON "days" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_day_version" ON "plans" USING btree ("day_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "presets_user_verb" ON "presets" USING btree ("user_id","verb");--> statement-breakpoint
CREATE INDEX "tasks_day" ON "tasks" USING btree ("day_id");