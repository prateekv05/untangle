# Untangle build pack

Everything needed to build Untangle with Claude Code, in one place.

Untangle: dump your brain by voice or text, get a realistic day with a reason for every choice, and re-plan in plain words when life changes. A phone-first PWA on Next.js, Neon and Claude.

## Start here (3 steps)

1. Create an empty repo and copy this whole folder into its root (so `CLAUDE.md` is at the top level).
2. Open Claude Code in that folder.
3. Open `BUILD_PROMPT.md`, paste the **Kickoff prompt**, then do Phase 0 to Phase 10 in order.

## What is in the pack

| Path | What it is |
| --- | --- |
| `CLAUDE.md` | Project memory Claude Code reads every session: scope, stack, rules, conventions |
| `BUILD_PROMPT.md` | Kickoff prompt + 10 phase prompts with acceptance criteria and a one-week pace |
| `docs/PRODUCT.md` | Positioning, the loop, re-plan, scope, success criteria, the 30-second demo |
| `docs/SCREENS.md` | Every screen, state, interaction and exact copy |
| `docs/ARCHITECTURE.md` | Stack, routes, PWA, identity, security |
| `docs/AI_CONTRACT.md` | The 3 AI calls, scheduling rules, repair loop, reason style |
| `docs/DATA_MODEL.md` | Neon tables and queries |
| `docs/VOICE.md` | Voice pipeline (Web Speech + server transcription), states, privacy |
| `prompts/` | `understand.md`, `plan.md`, `replan.md` system prompts |
| `evals/` | 15 test cases and the assertion vocabulary |
| `design/` | Design system doc, `tokens.json`, `tokens.css`, logo, component previews, 7 standalone screen HTML files |
| `src/lib/` | `schemas.ts` (Zod), `planner.ts` (deterministic planner + fallback), `validate-plan.ts`, `time.ts`, tests |
| `src/db/schema.ts` | Drizzle schema for Neon |
| `reference/prototype-v2.html` | Interactive prototype for behaviour reference (visuals superseded by `design/`) |
| `.env.example` | Environment variables (both AI providers, model allowlist, Whisper, Google sign-in) |

## What is already tested

`src/lib/planner.ts` and `src/lib/validate-plan.ts` have 8 passing unit tests (workday and day-off plans, appointment-anchored outing, re-plan with kept blocks, 3-hour capacity, must-finish, lighter afternoon, validator catches overlaps and missing tasks). `schemas.ts` and `db/schema.ts` typecheck. Everything else is specification: nothing else has been built or run.

Run the tests once Phase 0 is done: `npm run test` (Node's built-in `node:test`, run through `tsx`).

Decisions so far: speech to text is OpenAI Whisper; sign-up with Google is required to use the app, with onboarding (name, optional gender, explainer screens) and an optional password. They are built in Phase 3, right after the data layer, so everything after runs on real accounts.

## Live design links

- Design system: https://claude.ai/artifact/ThRUFMYjDbZCx4EvErhWLe
- Final screens: https://claude.ai/artifact/6qS5VkoponS5YTGXfKA2uQ

## Things to decide yourself (not in the pack)

- Which model combination wins. Candidates: Claude Sonnet 5.5, Claude Haiku 4.5, gpt-6.1-sol, gpt-6-luna. Decided by testing on the live site (`/dev/models`) and `npm run eval`.
- The product name and domain.
