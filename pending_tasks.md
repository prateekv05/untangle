# Pending tasks and gaps

Last updated: 2026-10-01. Tick `[x]` when done. Build progress per phase is tracked on the headings in `BUILD_PROMPT.md`.

## Build (see BUILD_PROMPT.md)

- [ ] Kickoff prompt (read docs, summarise, list risks and doc gaps)
- [x] Phase 0 scaffold and guardrails
- [x] Phase 1 static UI with fixtures
- [ ] Phase 2 data layer on Neon
- [ ] Phase 3 sign-up gate (Google, required), onboarding, optional password, account routes
- [ ] Phase 4 understand
- [ ] Phase 5 plan, validator, fallback
- [ ] Phase 6 execute
- [ ] Phase 7 re-plan
- [ ] Phase 8 voice
- [ ] Phase 9 PWA and polish
- [ ] Phase 10 evals, e2e, deploy, demo

Each phase prompt in `BUILD_PROMPT.md` also has a box per step and per Acceptance line.

## Decisions and checks waiting on you

- [ ] Check the Whisper model name (`STT_MODEL=whisper-1` in `.env.example`) against OpenAI's docs.
- [ ] Choose the product name and domain (the README lists it as undecided).
- [ ] Google Cloud OAuth client: create it (consent screen, privacy policy URL), set the redirect URIs for local and production, get `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Needed before Phase 3 (sign-up is required to use the app from then on).
- [ ] Pick the final models after live testing. Candidates: Sonnet 5.5, Haiku 4.5, gpt-6.1-sol, gpt-6-luna. Then trim `AI_MODEL_ALLOWLIST` and set the defaults.

## Gaps in the specs

- [ ] The four models may differ in structured-output support through the AI SDK. Unverified until Phase 4; a model that fails stays off the allowlist.
- [ ] Welcome / sign in and onboarding screens have no design yet. Phase 3 starts by designing `design/screens/08-welcome.html` and `09-onboarding-*.html` (name, gender, 3 explainers) in light and dark.
- [ ] Password rules are minimal (10 characters minimum). Revisit if you want a strength meter or breach check.
- [ ] No email sending exists, so there is no "forgot password" email or email verification. Recovery is "sign in with Google, then set a new password". Revisit only if password-only accounts are ever allowed.
- [ ] Sign-in rate limiting needs a store (and Google-only sign-up means no email verification is needed, since Google verifies the email). Reuse a Neon table or add a small one in Phase 10; not designed yet.
- [ ] `docs/SCREENS.md` mentions the install hint and offline states but Phase 9 has no design for the install hint on iOS. Decide visuals then.
- [ ] Gender is stored but not used. Decide whether it is needed at all, or only the name. Currently never sent to the AI or logs.
- [ ] Privacy copy: Settings says "Your voice is turned into text and then discarded." Audio now goes to OpenAI Whisper when the server transcriber is used. Reword to say that, and add a short privacy note for sign-in data. Also decide terms and privacy policy links on the Welcome screen (Google OAuth verification usually needs a privacy policy URL).
- [ ] Web Speech sends audio to the browser vendor's service in some browsers. Decide whether to disclose that.
- [ ] Live-test override page `/dev/models` is gated by `MODEL_SWITCH_KEY`; confirm it stays disabled in any shared or demo deploy.

## Not verified

- [ ] The 8 existing unit tests pass (README claim, not re-run in this session).
- [ ] `src/db/schema.ts` still typechecks after adding `google_sub`, `password_hash`, `name`, `gender`, `onboarded_at` and `plans.model` (edited, not compiled; no package.json yet).
- [ ] Anthropic and OpenAI model IDs work with their SDKs (you verified the OpenAI names; the call path is untested).

## Later (out of scope for v1)

Calendar import, push notifications, widgets, sharing, multi-day planning, learning from history, offline write queue (stretch in Phase 9).

## Phase 4 open items

- [ ] Anthropic credit balance ran out mid-run. Haiku 4.5 and Sonnet 5.5 passed 21/21 on the first schema, but after the flat-question wire schema Sonnet passed 21/21 and Haiku missed the "go for a run" duration question 3/3. Re-run `npm run eval -- --fast=anthropic:claude-haiku-4-5-20251001` once credits are back and fix the prompt if it still misses.
- [ ] Understand-stage add and remove of tasks are client-only (no POST /api/tasks, no delete). Phase 5 must sync them before planning.
- [ ] A new dump for a date that already has a day replaces that day (one day per user per date). Revisit with carry-over in Phase 6.
- [ ] SCREENS.md asks for a Retry button on the failure state; Phase 4 keeps the text and the main button retries.
- [ ] p95 latency on understand is 5 to 14 s depending on model; check the thinking screen on a slow phone.
