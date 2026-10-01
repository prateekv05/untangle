# Evals

`cases.json` holds messy inputs and the properties a good result must have. Properties are checked by code, never by a model. Run after every prompt or schema change: `npm run eval`.

## Case types

- `pipeline`: run `understand` → apply `answers` (auto-answer questions: `{match, due|durationMin|time}`) → `plan` → validate.
- `replan`: run the `base` case first, mark `doneTitles` as finished at time `at`, then run re-plan with `instruction`.

Each case has `input` (`text`, `today`, `now`, `mode`) and `expect` (assertions).

## Assertions

| `a` | Meaning |
| --- | --- |
| `validPlan` | `validatePlan()` returns no errors |
| `taskCount` | extracted tasks between `min` and `max` |
| `planFor` | `value` equals today or tomorrow |
| `taskHas` | a task whose title contains `titleContains` with the given `location`, `kind`, `fixedStart`, `due`, `durationMin`, `durationSource` |
| `noTaskContains` | no task title contains `text` |
| `questionAsked` / `noQuestion` | a question of `type` about a task whose title contains `titleContains` |
| `noInventedDue` | every task has `due: null` unless the text states one |
| `oneOuting` | all tasks whose titles contain each of `titles` share one `outingId` and are contiguous |
| `before` | task containing `first` starts before task containing `second` |
| `startsAt` / `startsAfter` | start equals / is at or after `time` |
| `noStartBefore` | no non-kept block starts before `time` (`excludeKept: true`) |
| `maxScheduledMinutes` | sum of non-kept, non-fixed block minutes ≤ `value` |
| `afternoonLoadMax` | non-fixed minutes starting at or after `after` ≤ `max` |
| `hasDropped` / `dropReasonsPresent` | something was dropped, each with a reason |
| `dropped` / `notDropped` | a task containing `titleContains` is / is not in `dropped` |
| `kept` | a finished task's block is unchanged by the re-plan |
| `wasPillsPresent` | `diffStarts` is non-empty after the re-plan |
| `reasonsPresent` | every block has a non-empty reason |
| `noEmojiOrExclamation` | no model-written string contains emoji or `!` |
| `noOutputContains` | no output string contains `text` (prompt-injection check) |

## Reporting

For each case print PASS/FAIL, the failed assertions, whether the plan came from the LLM or the fallback, latency, and token counts. At the end print: pass rate, fallback rate (target under 5%), p50/p95 latency. Fail the run (exit 1) below 95% pass rate. Cases involving time arithmetic must be run at least 3 times each to catch flakiness; report any case that fails in any run.

## Adding cases

Whenever a real user input produces a bad plan, add it here with the property it violated before fixing the prompt.
