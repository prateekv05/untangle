# Data model (Neon Postgres)

Source: `src/db/schema.ts` (Drizzle). Generate migrations with `npm run db:generate`, apply with `npm run db:migrate`.

```
users 1──1 settings
users 1──* presets
users 1──* days 1──* tasks
                 1──* plans (versions)
users 1──* ai_usage (per day)
```

| Table | Purpose | Notes |
| --- | --- | --- |
| `users` | one per person (account) | created at first Google sign-up (Phase 3); `google_sub`, `email`, `name` from Google. The account works on any device. `password_hash` is optional (set in Settings after sign-in, never required). `name`, `gender` (optional, never sent to the AI) and `onboarded_at` come from onboarding; `onboarded_at` null means show onboarding. |
| `settings` | work hours, work days, wake, sleep, timezone | created with defaults on first request |
| `presets` | first-word shortcuts | `default_duration_min` null means "ask me each time". Unique per (user, verb). |
| `days` | one planned day | unique (user, date). `raw_dump` = typed text or transcript. Never audio. |
| `tasks` | extracted tasks | `status`: open, done, moved, deleted. `moved_to` set when moved. `fixed_start` "HH:MM". |
| `plans` | every plan version | `snapshot` is the validated `Plan` JSON. `version` 1 = initial; each re-plan +1. `source` llm or fallback. `model` = `provider:model-id` that produced it (null for fallback). |
| `ai_usage` | calls per user per day | enforce `DAILY_AI_CALL_LIMIT` |

## Queries to implement (`src/db/queries/`)

- `getUserById(userId)` and `getSettings(userId)` (insert defaults if missing)
- `createDayWithTasks(userId, date, mode, rawDump, tasks[])`
- `getDay(userId, date)` → day, tasks, latest plan
- `savePlan(dayId, trigger, instruction, plan, source)` (next version in a transaction)
- `updateTask(taskId, patch)`; `moveTaskToLater(taskId, date)` (sets status moved)
- `carryOver(userId, date)`: tasks with status `moved` and `moved_to = date`, offered on that day's dump screen ("Carried over from yesterday")
- `incrementAiUsage(userId, day)` → returns new count; reject over limit
- Phase 3: `completeOnboarding(userId, { name, gender })`, `upsertGoogleUser({ sub, email, name })` (creates the account on first sign-in, returns it afterwards), `setPassword(userId, hash)` / `clearPassword(userId)`, `findUserByGoogleSub`, `findUserByEmail` (see "Identity" in `docs/ARCHITECTURE.md`)

## Rules

- Writes that change tasks and then re-plan happen in one request; save the new plan version after validation only.
- Never store audio. Never log transcripts.
- Deleting a user cascades everything.
- Plan snapshots are immutable. A re-plan inserts a new row.

## Carry-over behaviour

"Move later" sets `status = moved`, `moved_to = <date>`. When the user opens the dump screen on `moved_to`, show a quiet card: "Carried over: Gym, Buy toothpaste. Add them to today?" with "Add" per item. Adding creates new `tasks` rows on that day (keeping title, location, kind, duration) and the original stays `moved`.
