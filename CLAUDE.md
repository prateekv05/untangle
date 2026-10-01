# Untangle

A phone-first PWA where you dump your brain (voice or text), Untangle understands it, and lays out a realistic day. When life changes, you tell it in plain words and it rebuilds the rest of the day.

**One-line definition:** Untangle turns a messy list of things you need to do into a realistic day by understanding the relationships between them.

**Loop:** dump → understand → prioritize → schedule → execute → **re-plan** (the centerpiece).

## Read these first

| Need | File |
| --- | --- |
| What we are building and what we are NOT | `docs/PRODUCT.md` |
| Every screen, state and exact copy | `docs/SCREENS.md` |
| Visual rules, tokens, components | `design/DESIGN_SYSTEM.md`, `design/tokens.css` |
| Look at the real screens | `design/screens/*.html` (open in a browser) |
| Stack, folders, API, PWA, voice | `docs/ARCHITECTURE.md`, `docs/VOICE.md` |
| AI calls, prompts, schemas, validator | `docs/AI_CONTRACT.md`, `prompts/*.md`, `src/lib/schemas.ts` |
| Database | `docs/DATA_MODEL.md`, `src/db/schema.ts` |
| Build order and acceptance criteria | `BUILD_PROMPT.md` |
| Test cases for the AI | `evals/` |
| Working planner logic (behaviour reference) | `src/lib/planner.ts`, `reference/prototype-v2.html` |

Design source of truth (live): design system https://claude.ai/artifact/ThRUFMYjDbZCx4EvErhWLe, final screens https://claude.ai/artifact/6qS5VkoponS5YTGXfKA2uQ. If this repo and those disagree, the design system wins on visuals and `docs/PRODUCT.md` wins on scope.

## Non-goals (do not build, even if asked casually)

Untangle is NOT a task manager, calendar, or project tool. No lists, projects, tags, labels, subtasks, recurring tasks, calendar grid views, collaboration, notes, or integrations in v1. A day is created from a dump and lives for that day. If a feature makes Untangle feel like Todoist, Notion, Motion or Google Calendar, stop and ask.

## Stack

- Next.js (App Router) + TypeScript (`strict`), React Server Components where useful
- Tailwind CSS mapped to the CSS variables in `design/tokens.css`
- Serwist for the PWA (service worker, offline shell, install prompt). Follow its current docs.
- Vercel AI SDK + `@ai-sdk/anthropic` + `@ai-sdk/openai`. Use the structured-output function of the installed version (`generateObject` / `streamObject` at the time of writing) with Zod schemas.
- Models are swappable at runtime so we can test on the live site and keep what wins: Claude Sonnet 5.5 (`claude-sonnet-5-5`), Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), `gpt-6.1-sol`, `gpt-6-luna` (OpenAI IDs verified against OpenAI's API docs). See `docs/AI_CONTRACT.md` "Models".
- Neon Postgres + Drizzle ORM (`@neondatabase/serverless`, `drizzle-orm/neon-http`, `drizzle-kit`)
- Zod for every boundary: AI output, API input, settings
- Speech to text behind a `Transcriber` interface (`docs/VOICE.md`). Server provider: OpenAI Whisper. Web Speech API is used first where the browser supports it.
- `node:test` (Node's built-in runner, no install) via `tsx` for unit tests. Playwright for the demo-path e2e test.
- Auth.js (`next-auth`) with Google OAuth plus an optional password (Credentials provider, scrypt via `node:crypto`, no extra dependency), added in Phase 3 together with onboarding, right after the data layer. **Nobody can use the app without signing up with Google**; an account works on any device. Every API route resolves the user through `requireUser()`.
- Hosting: Vercel

Verify library APIs against the installed version's docs before using them. Do not guess signatures.

## Commands (create these npm scripts in Phase 0)

```
npm run dev          # next dev
npm run build        # next build
npm run typecheck    # tsc --noEmit
npm run lint
npm run test         # unit tests (planner, validator, schemas)
npm run db:generate  # drizzle-kit generate
npm run db:migrate   # drizzle-kit migrate (uses DATABASE_URL)
npm run eval         # AI evals against evals/cases.json (needs provider keys; `-- --plan=openai:gpt-6.1-sol --fast=openai:gpt-6-luna` to compare models)
```

Before saying a task is done: `typecheck`, `lint`, `test` all pass, and you have looked at the result in a browser at 390px width.

## Folder structure

```
src/
  app/                    # routes, layouts, API route handlers
    api/{transcribe,understand,plan,replan,day,tasks,settings,presets}/route.ts
  components/             # UI components, one per design-system component
  lib/
    schemas.ts            # Zod schemas (exists)
    planner.ts            # deterministic planner + fallback (exists, tested)
    validate-plan.ts      # deterministic validator (exists, tested)
    time.ts               # minute/HH:MM helpers (exists)
    ai/                   # understand.ts, plan.ts, replan.ts, models.ts (provider registry + allowlist + override), prompts loader
    stt/                  # Transcriber interface + implementations
    session.ts            # requireUser(): the one place routes get the current user (the Auth.js session)
    auth.ts               # Auth.js: Google OAuth + optional password (Phase 3)
  db/                     # schema.ts (exists), client.ts, queries/
design/                   # tokens + design system docs + reference HTML
docs/  prompts/  evals/  reference/
```

## Product rules that must hold everywhere

1. **Every scheduling decision has a human-readable reason**, one sentence, first person ("You're already out at the gym, so this goes on the way back home."). No reason, no block.
2. **Never decide what only the user can know.** A workout's length, a deadline, an appointment time: ask (see `Question` in schemas). Anything Untangle guessed is marked `durationSource: "estimated"` and shown in the "ask" colour until the user sets it.
3. **Ask less.** At most 3 questions, only when the answer changes the plan. One tap each.
4. **Show relationships.** If tasks belong to one trip, the UI shows one outing on one taut thread, not a flat list.
5. **Re-plan is the centerpiece.** Finished tasks stay put; everything else is rebuilt from "now". The result says what changed and why.
6. **The LLM proposes, code disposes.** Every plan passes `validatePlan()`. One automatic repair attempt with the error list, then fall back to `planDay()`. The user never sees an invalid plan or an error screen for a bad AI response.

## Design rules (full detail in `design/DESIGN_SYSTEM.md`)

- **Colour means where**: outside = green, work = blue, home = amber, anywhere = grey. Pink ("ask") means Untangle needs the user. Nothing else uses these colours.
- **Two voices**: user content and all controls use Schibsted Grotesk. Everything Untangle itself says (reasons, decisions, hints, re-plan summaries) uses Newsreader (upright serif, never italic). Never use the serif for headings, labels or buttons.
- Use CSS variables from `design/tokens.css`. No raw hex in components. Light and dark themes are both required, via `data-theme` on `<html>`.
- No italics anywhere. Emphasis comes from weight or colour, never italic.
- No emoji anywhere (icons are inline SVG, 20px, 1.75px stroke). Sentence case. No exclamation marks.
- No coloured left-border stripes on cards. Location is shown by the node on the thread and the WhereTag.
- Touch targets at least 44px. Real `<button>` / `<input>` + `<label>`. Visible focus ring. Respect `prefers-reduced-motion`.
- Only sheets and the toast cast shadows.
- Times are 24-hour `HH:MM`. Durations: `45 min`, `1 h 30 min`.

## Code conventions

- TypeScript strict. No `any`. Prefer `type` imports.
- Zod schema first, then infer the type. All AI output is parsed through Zod. All route handlers validate input with Zod.
- Secrets only on the server (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`). Never in client bundles, never logged.
- Scheduling math is in minutes since midnight (`time.ts`). Convert to `HH:MM` at the edges only.
- Pure logic (planner, validator, diff) has no I/O and has unit tests. Add a test with every bug fix.
- Prompts live in `prompts/*.md` and are loaded at build time, not inlined in code.
- Model IDs come from env (`AI_MODEL_PLAN`, `AI_MODEL_FAST`, `AI_MODEL_ALLOWLIST`), written `provider:model-id`, never hard-coded in call sites. Log and store the model used on every AI call and every saved plan.
- Rate limit AI routes per user per day (`ai_usage`), cap input length (4,000 chars) and audio (120 s).
- Audio is never stored. Transcripts are stored in `days.raw_dump` only.
- Small, reviewable commits. One concern per commit. Commit message: imperative, present tense.

## Ask before

- Adding a dependency that is not in this file's stack list
- Changing a schema in `src/lib/schemas.ts` or `src/db/schema.ts` after Phase 2 (needs a migration plan)
- Adding any screen or feature not in `docs/SCREENS.md` (Welcome and onboarding are in it, built in Phase 3)
- Anything that looks like the non-goals above

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
