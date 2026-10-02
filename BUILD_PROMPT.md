# Build prompt

How to use: put this whole pack in the root of an empty repo (so `CLAUDE.md` is at the top), open Claude Code there, paste the **Kickoff prompt**, then work through the phases one at a time. Paste each phase prompt, let Claude Code plan first, review, then let it build. Commit after each phase. Do not skip the acceptance checks.

Progress: `[ ]` = not done, `[x]` = done. Every phase heading, every numbered step inside a phase prompt, and its Acceptance line has a box. Tick a step when it is done, and the phase heading only after the Acceptance line passes. Open items and gaps live in `pending_tasks.md`.

Suggested pace: about nine days. Phase 0 and 1 on day 1, 2 on day 2, 3 on days 3 and 4, 4 and 5 on day 5, 6 on day 6, 7 on day 7, 8 on day 8, 9 and 10 on day 9. Phase 3 (sign-up gate, onboarding, optional password) comes right after the data layer, so everything from the AI phases on runs on real accounts; budget an extra day or two for it. If you slip, cut in this order: offline writes, streaming the plan, live heard-so-far chips, carry-over. Never cut re-plan or the validator.

---

## [ ] Kickoff prompt (paste once, at the start)

```
You are building Untangle, a phone-first PWA that turns a voice or text brain dump into a realistic day and rebuilds it when life changes.

First, read these files in full, in this order, and do not write code yet:
1. CLAUDE.md
2. docs/PRODUCT.md
3. docs/SCREENS.md
4. design/DESIGN_SYSTEM.md and design/tokens.css
5. docs/ARCHITECTURE.md, docs/AI_CONTRACT.md (including "Models"), docs/DATA_MODEL.md, docs/VOICE.md
6. src/lib/schemas.ts, src/lib/planner.ts, src/lib/validate-plan.ts and its tests, src/db/schema.ts
7. Open design/screens/*.html to see the real screens.

Then reply with:
- a one-paragraph summary of the product in your own words, including what we are NOT building
- the 5 riskiest parts of the build and how you will de-risk each
- any contradictions or gaps you found in the docs (list them; do not silently resolve them)
- confirmation that you will build phase by phase from BUILD_PROMPT.md and stop at the end of each phase for my review. The Google sign-up gate and onboarding are Phase 3 and must not be started earlier; nothing before it needs a signed-in user

Do not install anything or create files yet.
```

---

## [x] Phase 0: scaffold and guardrails

```
Phase 0. Scaffold the project. Plan first, then build.

1. [x] Create a Next.js App Router + TypeScript (strict) app in this repo root without overwriting existing files (CLAUDE.md, docs/, design/, prompts/, evals/, reference/, src/lib/*, src/db/schema.ts). Move generated files as needed so our existing src/ files stay where they are.
2. [x] Install and configure: Tailwind (map colours, radii, spacing and fonts to the CSS variables in design/tokens.css), zod, ai + @ai-sdk/anthropic + @ai-sdk/openai, drizzle-orm + drizzle-kit + @neondatabase/serverless, serwist (+ its Next integration, follow its current docs), tsx for running tests with Node's built-in test runner (`node:test`; do not add vitest), eslint. Do not install Auth.js yet; that is Phase 3.
3. [x] Fonts: next/font/google for Schibsted Grotesk (400, 500, 600, 700) and Newsreader (400 and 500, upright only, no italics) exposed as --font-sans and --font-serif.
4. [x] Import design/tokens.css globally. Theme: data-theme on <html>, default from prefers-color-scheme, override stored in localStorage, no flash of wrong theme.
5. [x] Add the npm scripts from CLAUDE.md. Make `npm run test` run every `*.test.ts` under src with `tsx --test` and pass (planner.test.ts is the first).
6. [x] Add .env.example (exists) handling: a typed env loader (zod) in src/lib/env.ts that fails fast with a clear message.
7. [x] Add a /dev/tokens page (dev only) that shows every colour token in both themes, the type styles, and spacing/radius, so we can eyeball fidelity to design/DESIGN_SYSTEM.md.
8. [x] Git: initial commit.

[x] Acceptance: `npm run typecheck && npm run lint && npm run test && npm run build` pass. /dev/tokens renders correctly in light and dark at 390 px. No raw hex values outside design/tokens.css.
```

## [x] Phase 1: static UI with fixture data

```
Phase 1. Build every screen in docs/SCREENS.md with FIXTURE data only. No database, no AI, no network.

0. [ ] Welcome and Onboarding are not built here; they come in Phase 3 (after their designs). Build everything else in docs/SCREENS.md.
1. [ ] Components (src/components), one per design-system component: Button, WhereTag (with time chip and fact pill variants), TaskBlock, Outing, Decisions, QuestionCard, Sheet (+ Toast), plus Thread (the spine and nodes), TopBar, SegmentedControl, Waveform, AddTaskCard, Chip. Match design/DESIGN_SYSTEM.md and design/reference-previews/*.html exactly.
2. [ ] Screens as routes or one client state machine (your call, explain it): Dump, Listening (mock transcript, mock waveform), Thinking, Understand, Plan (with all states: expanded block, finished, moved later, dropped, empty), Re-plan sheet, Re-planned state, Settings and Presets sheets.
3. [ ] Fixtures: build them by running our planDay() from src/lib/planner.ts on the example tasks in src/lib/__tests__/planner.test.ts, so the plan shown is a real valid plan.
4. [ ] Interactions that work without a backend: expand/finish/undo, edit sheet, move later with toast + undo, add task, mode toggle, theme toggle, sheets open/close with focus trap and Escape.
5. [ ] Motion: the plan entrance (thread draws down, blocks arrive with ~180 ms stagger, outing last) and nothing else decorative. Honour prefers-reduced-motion.
6. [ ] A /dev/gallery page listing every component in every state in both themes.

[ ] Acceptance: side by side at 390 px with design/screens/*.html the visuals match (spacing, type, colour, radii). Keyboard-only walkthrough works. axe finds no serious issues on any screen. `typecheck`, `lint`, `test` pass. Show me screenshots of each screen in light and dark.
```

## [x] Phase 2: data layer on Neon

```
Phase 2. Persistence layer. No auth yet (Phase 3), no AI yet.

1. [x] Drizzle client for Neon (src/db/client.ts, neon-http). Generate and apply the initial migration from src/db/schema.ts. The schema already includes the account columns (users.google_sub, email, name, gender, password_hash, onboarded_at) and plans.model. Do not change the schema without telling me why.
2. [x] Queries in src/db/queries/ as listed in docs/DATA_MODEL.md (getUserById, getSettings, createDayWithTasks, getDay, savePlan, updateTask, moveTaskToLater, carryOver, incrementAiUsage). Every query takes userId explicitly and filters by it; no query reads a cookie or session. Settings default rows are created by the account-creation query in Phase 3, but getSettings must also insert defaults if missing.
3. [x] Unit tests for the queries' pure helpers; an integration test script that inserts a user directly, then a day, tasks and a plan against a Neon branch DB (use env TEST_DATABASE_URL) and cleans up.

[ ] Acceptance: the migration applies cleanly to an empty Neon branch; the integration test passes; incrementAiUsage rejects the 41st call; a test proves one user cannot read another user's day or tasks; typecheck, lint, test pass.
```

## [x] Phase 3: sign-up gate, onboarding and optional password

```
Phase 3. Nobody can use Untangle without signing up. Build the Google sign-up gate, onboarding, the optional password, and the account-based routes. Everything after this phase builds on real accounts. Plan first, then build.

First, tell me before writing code: (a) the Auth.js version you will install and how you checked its current docs (adding next-auth is approved, nothing else new), (b) the sign-in rate-limit store (a small new table with a migration is approved if you need one), (c) what I must set up in Google Cloud for AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (OAuth client, consent screen, redirect URIs for localhost and production), step by step.

1. [x] Design the screens first, in light and dark: design/screens/08-welcome.html (Welcome / sign in) and design/screens/09-onboarding-name.html ... 13-onboarding-replan.html, per docs/SCREENS.md. Show me before building.
2. [x] Auth.js (src/lib/auth.ts; env AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET): the Google provider creates the account on first sign-in (upsertGoogleUser, with default settings) and signs in to the existing account afterwards, on any device, showing the same data. src/lib/session.ts exposes requireUser(), the only way routes get the current user (401 { error: "unauthorized" } otherwise). Every page and API route except Welcome and /api/auth/* requires a session (middleware redirect for pages).
3. [x] Welcome screen: "Continue with Google", and a "Sign in with a password" link for accounts that set one. No guest mode, no skip.
4. [x] Onboarding at /welcome/*: name (required, prefilled from Google), gender (optional, four options, null allowed), three explainer screens, progress dots, Back, Skip on explainers, "Start" sets onboarded_at. GET/PUT /api/me with Zod validation (name 1 to 40 chars, gender enum or null). Redirect rule: signed in and onboarded_at null goes to onboarding; otherwise onboarding is never shown again.
5. [x] Optional password: PUT/DELETE /api/me/password, signed in only; Auth.js Credentials provider (JWT sessions); scrypt via node:crypto, no new dependency; min 10 characters; rate-limit attempts per IP and per email; identical error for wrong password and unknown email. Settings "Password" row and "Sign out" per docs/SCREENS.md. Never prompt for a password during onboarding.
6. [x] The account-based routes (Zod-validated, all via requireUser()): GET/PUT /api/settings, GET/POST/DELETE /api/presets (delete is /api/presets/[id]), GET /api/day, PATCH /api/tasks/[id]. Built and tested; the UI uses them for settings and presets now. Task edits in the UI stay client-side until Phase 5, because tasks only exist in the database once a dump is saved as a day. Replace the fixtures in the UI for settings, presets and task edits (finish, edit, move later) with real calls. Optimistic updates with rollback on failure.
7. [x] Name is shown only in the Dump greeting and the Settings account row. Gender and name are never included in any prompt or log.
8. [x] Tests: unit tests for upsertGoogleUser, requireUser, password hashing/verify and rate limiting, the /api/me schema and the redirect rule; route tests that every route returns 401 without a session and 400 with malformed input; Playwright: signed out sees only Welcome, a new account goes through onboarding once into Dump, a returning sign-in goes straight to Dump with saved data, sign-in mocked at the Auth.js boundary.

[x] Acceptance: a signed-out visitor sees only the Welcome screen and every API route returns 401; a new Google account is routed through onboarding exactly once; signing in with Google (or password, if set) in a second browser shows exactly the same days, tasks, plans, presets and settings; setting, changing and removing a password works and Google sign-in still works afterwards; sign-out returns to Welcome; refresh keeps state; routes reject malformed input with 400 and typed errors and never leak stack traces; password hashes never leave the server; Google failure shows the quiet error and lets me retry; no secrets in the client bundle; no gender or name in logs or prompts (grep); axe has no serious issues; typecheck, lint, test pass; screenshots at 390 px in both themes.
```

## [x] Phase 4: understand

```
Phase 4. Implement the understand call.

1. [x] src/lib/ai/models.ts: parse `provider:model-id` from AI_MODEL_PLAN / AI_MODEL_FAST, build the AI SDK model for `anthropic` or `openai`, expose getModel("plan" | "fast"), validate against AI_MODEL_ALLOWLIST, and support a per-user override (httpOnly cookie) set from a /dev/models page that requires MODEL_SWITCH_KEY (disabled when the key is empty). Candidates: anthropic:claude-sonnet-5-5, anthropic:claude-haiku-4-5-20251001, openai:gpt-6.1-sol, openai:gpt-6-luna. Unit-test the parsing, allowlist and override logic. src/lib/ai/prompts.ts loads prompts/*.md at build time.
2. [x] src/lib/ai/understand.ts: structured output (Zod UnderstandResult) via the AI SDK + Anthropic, using prompts/understand.md. Pass today, now, timezone, settings, presets. Treat user text as untrusted.
3. [x] POST /api/understand: validate input (≤ MAX_DUMP_CHARS), enforce daily AI limit, call understand, create the day (for planFor) and tasks, return the UnderstandResult plus ids. On model failure return a typed error and keep the user's text (UI shows the "I couldn't read that just now" state).
4. [x] Wire Dump → thinking → Understand to the real route. Show real questions and the relationship card from `groupings`. Answers update tasks (due, durationMin + durationSource: "user", fixedStart).
5. [x] Extend evals: write the eval runner skeleton (scripts/eval.ts) that can run the `pipeline` cases through understand only for now and checks taskCount, taskHas, questionAsked, noQuestion, noInventedDue, planFor, noTaskContains, noOutputContains.

[x] Acceptance: understand works with each of the four models (same prompt, same schema; report any that cannot structured-output reliably); the canonical dump yields 7 tasks with correct locations; asks a due question for SQL and a duration question for gym and nothing else; "gym for 90 minutes" asks no duration question; the injection case is ignored; evals for understand pass at ≥ 95% over 3 runs.
```

## [~] Phase 5: plan + validator + fallback

```
Phase 5. Implement the plan call with the safety net.

1. [x] src/lib/ai/plan.ts: structured output (Zod Plan) using prompts/plan.md. Inputs per docs/AI_CONTRACT.md (tasks with answers, settings, mode, now, planFrom).
2. [x] Pipeline in src/lib/ai/pipeline.ts: model → Zod → validatePlan → one repair call with the error list → planDay() fallback. Record source ("llm" | "fallback"), the model used, latency, token counts, validator errors (never transcripts) in logs, and save the model in plans.model.
3. [x] POST /api/plan: loads tasks + answers, builds mode from settings and date, runs the pipeline, saves plan version 1, returns the Plan.
4. [x] Wire Understand → thinking → Plan with real data. Decisions card, outing group, hops, note and "Didn't fit today" all come from the Plan object. Compute workday/dayoff markers from settings.
5. [x] Never reveal an unvalidated plan. If streaming, stream into a staging buffer and reveal after validation with the entrance animation. If not streaming, keep the thinking screen until done.
6. [x] Extend scripts/eval.ts to run full pipeline cases and every plan assertion in evals/README.md.

[~] Acceptance (p50 is borderline, see below): `npm run eval` passes ≥ 95% for pipeline cases over 3 runs; fallback rate under 5% (report it, per model); a deliberately broken model response (inject via a test hook) is repaired or falls back and the user sees a valid plan; plan p50 latency under 6 s (report p50/p95).

Measured (9 pipeline cases x 3 runs, understand on Haiku 4.5, 27 plan calls per model), first pass with the long prompt:
| plan model | pass | fallback | plan p50 / p95 |
| claude-sonnet-5-5 | 100% | 0% | 7.8 s / 14.1 s |
| gpt-6-luna | 100% | 0% | 7.1 s / 11.3 s |
| claude-haiku-4-5 | 100% | 18.5% | 5.3 s / 9.8 s (concurrent run) |
| gpt-6.1-sol | 92.6% | 0% | 13.8 s / 23.3 s (concurrent run) |
Then the plan prompt was tightened (reasons 6 to 16 words, 4 decisions) and OpenAI calls got `reasoningEffort: "low"` (the prompt change alone did not help: the time is reasoning, not visible output). Default plan model for now: `openai:gpt-6-luna`. Result: pass 100%, fallback 0%, plan p50 5.9 s and 6.7 s over two runs, p95 about 13 s. p50 sits on the 6 s line and is noisy run to run.
Broken responses (invalid plan, throwing model) are covered by pipeline unit tests.
Deferred by decision: compare all four models on quality, latency and cost once the app is finished.
```

## [x] Phase 6: execute

```
Phase 6. Make the day usable.

1. [x] Finish/undo, Edit (name, location, duration, fixed time → "Save and re-plan" which re-runs the plan pipeline for unfinished tasks with finished blocks kept), Delete, Move later (+ undo), Bring back, "Forgot something? Add it" on the plan (adds a task via the same understand-lite path: use the add card's fields directly, and re-plan).
2. [x] Carry-over card on the Dump screen for tasks moved to today.
3. [x] Every re-plan saves a new plan version; keep the previous so Undo can restore it.
4. [x] Progress and headline logic ("N of M done").

[x] Acceptance: finishing never moves a block; editing a duration re-plans only unfinished tasks; moved tasks appear on the target date's dump screen; undo restores the previous plan version exactly; all mutations validated and persisted.

Built: `POST /api/day/edit` (edit, delete, add, move, bring back; re-plans unfinished tasks with finished blocks kept, saves the next version), `POST /api/day/undo` (saves the old snapshot again as the newest version with trigger `edit`, instruction "undo"; no migration), `GET /api/day` defaults to today in the user's timezone and the app reopens on it. Finish and unfinish use `PATCH /api/tasks/:id`.
Checked: 96 unit tests, DB integration (restore round trip, user scoping), e2e 60 with the stubbed routes, and the real-model e2e (finished block unchanged, version 2, undo gives a plan equal to version 1). Not done: the free-text re-plan sheet still uses fixtures (Phase 7); Undo is lost on reload; a day that was understood but never planned shows the Dump screen on reopen.
```

## [~] Phase 7: re-plan (the centerpiece)

```
Phase 7. Re-plan is the product. Make it great.

1. [x] src/lib/ai/replan.ts: interpret (prompts/replan.md → ReplanConstraints) then re-plan per docs/AI_CONTRACT.md section "3b": compute minStart, kept blocks, durationOverrides, newEvents → tasks of kind "fixed", capacity, lighterAfter, mustFinish, drops. Then run the same plan pipeline (validate with keptTaskIds and durationOverrides, repair, fallback to planDay with the same options).
2. [x] POST /api/replan: { dayId, instruction } → { plan, changes } where changes.was comes from diffStarts(previousPlan, newPlan). Save as a new plan version with trigger "replan" and the instruction.
3. [x] UI: dock button opens the Re-plan sheet; live clock line; text box; quick chips fill the box with sentences (chips that need a target open a picker of today's open tasks; "Running late" offers 30 min / 1 h / 90 min / 2 h). Submit → thinking ("Rebuilding the rest of your day") → Replanned state: "Re-planned at HH:MM", user's words, "Here is what I changed" card, Now marker, was-pills, collapsed done row, 8-second Undo toast.
4. [x] Announce results with aria-live. On failure: toast "I couldn't rebuild that. Your plan is unchanged."
5. [x] Evals: add all `replan` cases to scripts/eval.ts.

[~] Acceptance (quality met, latency not): "I didn't finish SQL and I have a meeting at 2" at 11:45 yields a valid plan: finished tasks unchanged, meeting at 14:00, SQL still protected, outing intact, nothing new before 11:45, was-pills present. "Only 3 hours" respects 180 min and drops the lowest priority. "Lighter afternoon" keeps afternoon load ≤ 100 min. "Finish the app today" is never dropped. Re-plan p50 under 6 s. All replan evals pass at ≥ 95% over 3 runs.

Built: `src/lib/replan.ts` (pure: checks the model's ids and numbers, minStart, durationOverrides, change lines), limits threaded through `PlanInput`, `validatePlan` (capacity, lighterAfter, must-finish, no dropping a commitment whose time has not passed) and the `planDay` fallback, `src/lib/ai/replan.ts` (interpret on the fast model), `POST /api/replan` (saves version with trigger `replan` and the instruction; new events become `fixed` tasks, dropped tasks move to tomorrow; an unreadable sentence returns 502 and saves nothing), the sheet now calls it with the "Rebuilding the rest of your day" thinking screen, change card, was-pills and 8 s Undo (reuses `/api/day/undo`). The fixture interpreter and the client-side re-plan reducer are gone. `npm run eval -- --type=replan` runs the six cases.
Measured (6 replan cases x 3 runs, interpret on Haiku 4.5, plan on gpt-6-luna): pass 94.4% to 100% over runs (one failure each in two of four runs: a "Meeting" overlapping a block the user had finished early, and an LLM drop that the new validator rule now rejects), fallback 0% to 5.6%, re-plan p50 10.6 to 11.8 s, p95 about 22 s (interpret is 1.2 to 2.5 s; the plan call is the rest). Haiku as plan model: 55% fallback, rejected. 9 pipeline cases still 100%.
Not met: re-plan p50 under 6 s. The plan call's reasoning time dominates (same cause as Phase 5). Needs a decision: a faster plan model, a shorter re-plan prompt, or using `planDay` directly for pure-arithmetic sentences (capacity, lighter, late).
Still faked or open: the mic in the re-plan sheet types a canned sentence (Phase 8); Undo is lost on reload; a finished block that sits in the future can overlap a new fixed event the user adds (kept blocks never move).
Checked: 110 unit tests, e2e 82 with stubbed routes (re-plan stub runs the same pure rules and planDay), real-model e2e for re-plan, screenshot at 390 px.
```

## [ ] Phase 8: voice

```
Phase 8. Voice is the hero input. Follow docs/VOICE.md.

1. [ ] src/lib/stt/types.ts (Transcriber), WebSpeechTranscriber (feature detected), ServerTranscriber (MediaRecorder, mime fallback for Safari) and POST /api/transcribe (≤ 120 s, ≤ 5 MB, enforces the daily limit, discards audio after transcription). Provider is OpenAI Whisper (STT_PROVIDER=openai, STT_MODEL, OPENAI_API_KEY) behind a single transcribe(blob) function.
2. [ ] Listening screen for real: live transcript, timer, waveform driven by an AnalyserNode where available, "Planning for tomorrow, Friday" chip from the text, heard-so-far chips (debounced cheap extraction or client-side split, see VOICE.md), Done talking, close = discard, 120 s auto-stop toast.
3. [ ] All permission and error states in docs/SCREENS.md and docs/VOICE.md.
4. [ ] Voice on the Re-plan sheet: the mic fills the text box; never auto-submit.
5. [ ] Keep text input first-class everywhere; voice must never be required.

[ ] Acceptance: works on desktop Chrome and on an iPhone in Safari (via ServerTranscriber) and on Android Chrome; denied permission falls back gracefully; no audio is stored (verify); the whole demo path (speak → plan) completes in under 20 seconds on a normal connection.
```

## [ ] Phase 9: PWA and polish

```
Phase 9. Make it installable, offline-readable and polished.

1. [ ] Serwist: manifest (name Untangle, standalone, colours from tokens, maskable icons generated from design/assets/untangle-mark.svg on an ink tile), precache shell and fonts, stale-while-revalidate for GET /api/day so today's plan opens offline. Offline: disable edit actions with "You're offline." (queueing writes is an optional stretch).
2. [ ] Install hint after the first successful plan (dismissible; iOS shows Add to Home Screen instructions).
3. [ ] Dark mode audit on every screen; contrast check for all text/background pairs; focus rings; 44 px targets; reduced motion.
4. [ ] Empty/error/offline states from docs/SCREENS.md; skeletons only where waits exceed 300 ms.
5. [ ] Performance: Lighthouse PWA and performance ≥ 90 on mobile for the Dump and Plan screens.

[ ] Acceptance: installs on Android and iOS; plan opens in airplane mode; Lighthouse targets met; axe has no serious issues; visual diff against design/screens/*.html is clean at 390 px in both themes.
```

## [ ] Phase 10: evals, e2e, deploy, demo

```
Phase 10. Ship it.

1. [ ] Finish scripts/eval.ts: reporting per evals/README.md (pass rate, fallback rate, p50/p95 latency, tokens), broken down per model. Accept `--plan=` and `--fast=` to run the whole suite on any allowlisted model, so the four candidates can be compared. `npm run eval` exits 1 under 95%.
2. [ ] Playwright e2e for the demo path with the model mocked at the route boundary: dump → questions → plan → finish → move later → re-plan → undo.
3. [ ] Vercel deploy: add the production redirect URI to the Google OAuth client, env vars (including both provider keys, AUTH_SECRET, the Google client id and secret, and MODEL_SWITCH_KEY), Neon pooled connection, region near the Neon region, rate limits verified in production, no secrets in client bundle (grep the build output).
4. [ ] Add basic analytics-free logging per docs/ARCHITECTURE.md. No transcripts in logs.
5. [ ] README.md for the repo (what it is, setup, env, scripts, how to run evals).
6. [ ] Write docs/DEMO.md: the exact 30-second script from docs/PRODUCT.md, the demo dump to read aloud, and the re-plan sentence, plus a checklist for recording (clean phone, dark and light takes, screen recording at 60 fps).

[ ] Acceptance: production URL works end to end on a phone; evals ≥ 95%; e2e green in CI; I can open /dev/models on the live site with the key, sign in with Google and switch plan and fast models for my user only, and see the model in the logs and in plans.model; I can record the 30-second demo in one take.
```

---

## Working agreements for every phase

- Plan first. Show me the plan, wait for approval, then build.
- Small commits, one concern each.
- After each phase run: `npm run typecheck && npm run lint && npm run test`, and look at the app at 390 px.
- If docs conflict, stop and ask. Do not silently pick.
- If you think a non-goal would help the product, say so; do not build it.
- Report honestly: what works, what is faked, what is untested.
