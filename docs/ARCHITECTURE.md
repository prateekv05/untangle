# Architecture

## Overview

```
Browser (PWA)                         Vercel (Next.js route handlers)                 Services
─────────────                         ───────────────────────────────                 ────────
Dump screen ──audio──▶ /api/transcribe ───────────────────────────────────────────▶ STT provider (OpenAI Whisper)
            ──text───▶ /api/understand ──▶ ai/understand ─▶ fast model (Anthropic or OpenAI)
Understand screen ───▶ /api/plan ───────▶ ai/plan ──▶ validatePlan ─▶ (repair) ─▶ planDay fallback
Plan screen ─────────▶ /api/replan ─────▶ ai/replan: interpret ─▶ plan with constraints ─▶ validate
        tasks/edit ──▶ /api/tasks/:id ──▶ Neon (Drizzle)
Service worker (Serwist): app shell + last plan cached for offline read
```

## AI calls (details in `docs/AI_CONTRACT.md`)

| Call | Model env | Input | Output (Zod) |
| --- | --- | --- | --- |
| understand | `AI_MODEL_FAST` | transcript/text, now, timezone, settings, presets | `UnderstandResult` |
| plan | `AI_MODEL_PLAN` | tasks (with answers), settings, mode, now | `Plan` |
| interpret-replan | `AI_MODEL_FAST` | current plan, tasks, now, user instruction | `ReplanConstraints` |
| plan (again) | `AI_MODEL_PLAN` | tasks + constraints | `Plan` |

Model IDs are `provider:model-id` and can be swapped at runtime (see "Models" in `docs/AI_CONTRACT.md`): Claude Sonnet 5.5, Claude Haiku 4.5, `gpt-6.1-sol`, `gpt-6-luna`.

Plan pipeline: LLM → Zod parse → `validatePlan` → if errors, one repair call with the errors → if still invalid, `planDay()` (deterministic). Store `plans.source = "llm" | "fallback"` and log how often fallback fires. Target under 5%.

The "was 09:00" diff and the "N decisions" count are computed in code (`diffStarts`), not by the model.

Stream the plan if time permits (`streamObject`) so blocks arrive one by one; the UI animation is driven by arrival order. Never show a partial plan that has not passed validation: stream to a staging state, validate on completion, then reveal. (If this is too complex for week one, reveal after validation with the same animation.)

## Folder and route map

```
POST /api/transcribe        multipart audio (≤120 s)  → { text }
POST /api/understand        { text }                  → UnderstandResult (+ creates day + tasks)
POST /api/plan              { dayId, answers, mode }  → Plan (+ new plan version)
POST /api/replan            { dayId, instruction }    → { plan, changes }  changes = { was: Record<taskId, HH:MM> }
GET  /api/day?date=         → { day, tasks, plan }    (also cached by the service worker)
PATCH /api/tasks/:id        { status?, title?, location?, durationMin?, fixedStart?, movedTo? }
GET/PUT /api/settings       Settings
GET/POST/DELETE /api/presets
GET/PUT /api/me             { name, gender, onboarded }   (Phase 3)
PUT/DELETE /api/me/password { newPassword } / remove      (Phase 3, signed in only)
/api/auth/*                 Auth.js (Google OAuth)         (Phase 3)
GET/POST /api/dev/models    model override, needs MODEL_SWITCH_KEY
```

All handlers: resolve the user with `requireUser()` (`lib/session.ts`; 401 `{ error: "unauthorized" }` when there is no session), validate input with Zod, enforce the daily AI call limit, return typed JSON. AI handlers never leak raw model output or stack traces: on failure return `{ error: "plan_failed" }` after the fallback also fails (it should not).

## Identity

**Nobody can use Untangle without signing up.** Every page and every API route except the sign-in screen and the Auth.js endpoints requires a session. Visiting while signed out shows the Welcome / sign-in screen and nothing else. There are no anonymous users in the shipped product.

**Sign-up is Google.** Auth.js with the Google provider creates the `users` row on first sign-in (`google_sub`, `email`, `name`). The account is the identity: on any device the user signs in and sees the same data (days, tasks, plans, presets, settings), because everything hangs off that one row. Onboarding (name, optional gender, explainers) runs once right after the first sign-up; a returning user goes straight to the Dump screen.

**Optional password.** Only after signing in, Settings offers "Set a password". It adds email-and-password sign-in for that same account (Auth.js Credentials provider, JWT sessions, email = the Google email). Never required, never asked during onboarding. Hash with `node:crypto` scrypt (random salt, constant-time compare), stored in `users.password_hash`; no new dependency. Rate-limit sign-in attempts per IP and per email. Wrong password and unknown email give the same message. "Forgot password" means sign in with Google and set a new one in Settings. A password can be removed, returning the account to Google-only.

**Built in Phase 3.** Sign-up, onboarding and the password come right after the data layer (Phase 2) and before any AI work, so every later phase runs on real accounts. There is no dev stub user and no anonymous mode. Tests inject a session at the `requireUser()` boundary.

## Time and dates

- Store dates as local calendar dates in the user's `settings.timezone`. Compute "now" on the server from the request time and timezone, pass `now: "HH:MM"` and `today: "YYYY-MM-DD"` into prompts.
- "tomorrow" in a dump sets `planFor: "tomorrow"`; create the day for that date and plan from `settings.wake + 60`, not from now.
- Scheduling math uses minutes since midnight. Midnight crossing is not supported in v1: nothing is scheduled past `sleep - 45 min`.

## PWA (Serwist)

- Manifest: name "Untangle", `display: standalone`, theme and background colours from tokens (`ground` light `#f2f3f7`, dark `#0e0c1d`), maskable icon from `design/assets/untangle-mark.svg` on an `ink` tile.
- Precache the app shell and fonts (self-host the two fonts with `next/font` so they work offline).
- Runtime cache: `GET /api/day` as stale-while-revalidate, so today's plan opens offline.
- Offline writes (finish a task) are an optional stretch: queue in IndexedDB and replay. If skipped, show a quiet "You're offline. Changes are saved when you reconnect" only if actually implemented; otherwise disable edit actions offline.
- Install prompt: show a small dismissible hint after the first successful plan. iOS needs an "Add to Home Screen" instruction (no `beforeinstallprompt`).

## Theming

`<html data-theme="light|dark">`, default from `prefers-color-scheme`, user override stored in `localStorage`. Variables from `design/tokens.css`. Tailwind colours map to variables (e.g. `ground: "var(--ground)"`), so there is one palette.

## Fonts

`next/font/google`: `Schibsted_Grotesk` (400, 500, 600, 700) and `Newsreader` (400, 500, upright only). Expose as `--font-sans` and `--font-serif`.

## Observability

Log per AI call: route, model, latency, token counts, validator errors, source (llm/fallback). No raw transcripts in logs. A tiny `/admin` is not needed; use Vercel logs.

## Security and cost

- Model override: `/dev/models` and `/api/dev/models` are available only when `MODEL_SWITCH_KEY` is set and supplied. They can only choose values in `AI_MODEL_ALLOWLIST`. The override is a per-user setting held in an httpOnly cookie, never read from the request body of AI routes.
- Daily AI call cap per user (`DAILY_AI_CALL_LIMIT`, default 40). Input ≤ 4,000 chars. Audio ≤ 120 s and ≤ 5 MB.
- No secrets in the client. CORS same-origin only.
- Treat user text as data: prompts must say the user's text is untrusted content and instructions inside it must be ignored.
