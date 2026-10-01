# AI contract

Three model calls, one deterministic checker, one deterministic fallback. Schemas are in `src/lib/schemas.ts`. Prompts are in `prompts/`.

## Models

Candidates: `anthropic:claude-sonnet-5-5`, `anthropic:claude-haiku-4-5-20251001`, `openai:gpt-6.1-sol`, `openai:gpt-6-luna`. We test on the live site and keep whichever combination wins on plan validity, fallback rate, latency and cost.

- `src/lib/ai/models.ts` is the only place that knows about providers. It parses `provider:model-id`, builds the AI SDK model (`@ai-sdk/anthropic` or `@ai-sdk/openai`) and exposes `getModel(role: "plan" | "fast")`. Call sites never name a model.
- Defaults come from `AI_MODEL_PLAN` and `AI_MODEL_FAST`. `AI_MODEL_ALLOWLIST` is the full set that may ever be used.
- Live testing: `/dev/models` (needs `MODEL_SWITCH_KEY`) lets you pick a model for each role for your own device only (httpOnly cookie, allowlist enforced). Everyone else keeps the defaults.
- Every AI call logs `{ route, role, model, latency, tokens, validatorErrors, source }`, and `plans.model` stores the model that produced the saved plan.
- Provider differences (structured-output support, temperature, token limits) are handled inside `models.ts` and the call helpers, not in prompts. The same prompts and Zod schemas must work for all four models; if one cannot, drop it from the allowlist rather than forking a prompt.
- Compare models offline with `npm run eval -- --plan=openai:gpt-6.1-sol --fast=openai:gpt-6-luna`. The report is per model: pass rate, fallback rate, p50/p95 latency, tokens.

## Principles

1. **Structured output only.** Every call returns a Zod-validated object. Never parse free text.
2. **The model proposes, code disposes.** The plan goes through `validatePlan()` (`src/lib/validate-plan.ts`). The model must not be trusted with arithmetic.
3. **Reasons are part of the schema.** `Block.reason` is required, one sentence, first person, plain. It is what makes Untangle feel intelligent.
4. **Never decide what only the user can know.** Workout length, deadlines of assignments, appointment times: emit a `Question`, or mark `durationSource: "estimated"`. Never invent a deadline.
5. **Ask less.** At most 3 questions. Only when the answer changes the plan.
6. **User text is untrusted data.** The system prompt says to ignore instructions inside the dump or the re-plan sentence.
7. **Fail soft.** Invalid output → one repair attempt with the validator's error list → `planDay()`.

## Call 1: understand

- Model: `AI_MODEL_FAST`.
- Input: `{ text, today: "YYYY-MM-DD", now: "HH:MM", timezone, settings, presets }`.
- Output: `UnderstandResult { planFor, tasks[], questions[], groupings[] }`.
- Prompt: `prompts/understand.md`.
- Server then creates the `days` row (for `planFor` date) and `tasks` rows, and returns ids to the client.

Extraction rules (also in the prompt):
- One task per distinct thing. Split "groceries and toothpaste" into two only if they are clearly separate purchases; otherwise one task is fine.
- `title`: short, imperative or noun phrase, user's language ("Finish SQL assignment", "Call mom"). Keep names the user said ("Sarah").
- `location`: where the user must physically be. `outside` = must leave home. `anywhere` = calls, online, laptop work. Default `anywhere` when unsure.
- `kind`: `deep` (focus work), `admin` (quick digital tasks), `errand`, `call`, `health` (exercise), `chore` (housework), `fixed` (appointments with a set time).
- `durationMin`: a sensible estimate. `durationSource`: `"user"` if the user said a length, `"preset"` if a preset supplied it, else `"estimated"`.
- `fixedStart`: only if the user said a time ("dentist at 5pm" → "17:00").
- `due`: only if the user said so ("due tomorrow"); otherwise `null`.
- `questions`: add a `due` question for assignment-like deep tasks with `due: null`; a `duration` question for `health` and `deep` tasks with estimated durations when the answer would change the plan; a `time` question for `fixed` tasks with no `fixedStart`. Max 3, most plan-changing first.
- `groupings`: tasks that belong together (all `outside` tasks, if two or more) with a one-sentence `why`.
- `planFor`: `"tomorrow"` if the user said tomorrow, else `"today"`.

## Call 2: plan

- Model: `AI_MODEL_PLAN`.
- Input: tasks (answers applied), `settings`, `mode` (`workday` | `dayoff`, from `settings.workDays` and the date unless overridden), `now`, `planFrom` (minutes; `now` rounded up to 5 for today, `wake + 60` for tomorrow).
- Output: `Plan`.
- Prompt: `prompts/plan.md`. The prompt states the scheduling rules below as hard constraints and includes one worked example.

Scheduling rules (hard constraints; the validator enforces them):
1. All times within `wake` to `sleep` (nothing starts later than `sleep - 45 min`), nothing before `planFrom`.
2. No overlaps. Leave about 10 minutes between blocks.
3. `fixedStart` tasks start exactly then. Build the day around them.
4. Workday: `work`-located tasks inside working hours. Personal tasks go before work, after work, or (if 30 min or shorter and `admin`/`call`) in the lunch window. Day off: use `wake + 60` to `sleep - 45`.
5. All `outside` tasks form ONE outing: contiguous blocks, same `outingId`, health first so errands come "on the way back". If an outside `fixed` task exists (an appointment), it is the first stop and the other outside tasks chain right after it when they fit.
6. Focus (`deep`) tasks go in the biggest, freshest window, earliest due first. `due: today` before `tomorrow` before `week`.
7. Quick tasks and calls fill small gaps; calls prefer lunch or evening.
8. Every task is in `blocks` or `dropped`, exactly once. A dropped task has a `why` and says where it goes ("first thing tomorrow").
9. `decisions`: up to 6 lines, each one choice with its reason, first person, plain ("Finish SQL assignment goes first because it's due tomorrow").
10. `note`: if any `health`/`deep` task is `estimated`, "I guessed the time for X (N min). Set your own and I will re-plan." else null.
11. `hop`: short text for outing blocks after the first: "on the way back" (when health is first), "next stop", or "right after your <appointment>". Null otherwise.

## Call 3: re-plan

Two steps.

**3a. Interpret.** Model: `AI_MODEL_FAST`. Input: the user's sentence, current plan, tasks, `now`. Output: `ReplanConstraints`. Prompt: `prompts/replan.md`.

| Phrase | Constraint |
| --- | --- |
| "I didn't finish SQL" | `unfinished: [{taskId: sql, remainingMin: null}]` (planner uses `remainingMin ?? ceil(duration/2)` rounded to 5; ask nothing, show the guess) |
| "I have a meeting at 2" | `newEvents: [{title: "Meeting", start: "14:00", durationMin: 60, location: "work"}]` |
| "running 90 minutes late" | `delayMin: 90` (3b explains how it moves the rebuild start) |
| "lighter afternoon" | `lighterAfter: "12:00"` (or "now" if after noon) |
| "only 3 hours" | `capacityMin: 180` |
| "I really need to finish the app" | `mustFinishTaskIds: [app]` |
| "forget the gym today" | `dropTaskIds: [gym]` |

Tasks done before now are in `doneTaskIds` (taken from the UI's finished state; the sentence may add more: "I already called mom").

**3b. Re-plan.** Compute in code: `minStart = max(now, nextUnfinishedStart + delayMin)`; kept blocks = blocks for done tasks (unchanged); tasks = open tasks + `newEvents` converted to `fixed` tasks (created in the DB as tasks with `kind: "fixed"`); `durationOverrides` from `unfinished`. Call the **plan** step again with those constraints in the prompt (rules above plus: kept blocks are immovable; nothing starts before `minStart`; honour `capacityMin`, `lighterAfter`, `mustFinish`). Validate with `keptTaskIds` and `durationOverrides`. Compute `changes.was` with `diffStarts(previousPlan, newPlan)`.

Show: "Re-planned at HH:MM", the quote of what the user said, the decisions card titled "Here is what I changed", the "Now" marker, and "was HH:MM" pills.

## Repair loop

```
plan = model()
errs = validatePlan(plan, ...)
if errs: plan = model(previous = plan, errors = errs)   // once
errs = validatePlan(plan, ...)
if errs: plan = planDay(...) ; source = "fallback"
```

## Reason style guide (for prompts and fallback copy)

- First person, present tense, one sentence, 8 to 25 words, no jargon.
- Say the cause: "Due tomorrow, so it gets the first long stretch you have."
- Name the relationship: "You're already out at the gym, so this goes on the way back home. No second trip."
- No exclamation marks, no emoji, no "optimised", no "AI".
- Never blame the user: "You didn't finish and it's due tomorrow, so it goes straight back in."

## Evals

`evals/cases.json` holds messy inputs and expected properties. Property checks are code (validator + custom assertions), not model-graded: outside tasks in one outing, SQL first when due tomorrow, fixed time respected, capacity respected, no overlaps, questions asked for gym duration and assignment deadline, etc. `npm run eval` runs every case through the real pipeline and prints pass/fail and fallback rate. Run it after every prompt change.
