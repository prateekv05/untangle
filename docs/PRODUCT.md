# Product

## What Untangle is

The place where you dump your brain. You say or type everything on your mind, in any order. Untangle works out what each thing is, what depends on what, what belongs together, what matters most, and lays out a realistic day, with a reason for every choice. When the day changes, you tell it in plain words and it rebuilds the rest.

> Untangle turns a messy list of things you need to do into a realistic day by understanding the relationships between them.

Signature moment: **"I figured out these things belong together."**

## What it is not

Not a task manager, not a calendar, not a scheduling assistant. It does not compete with Notion, Todoist, Motion, Sunsama, Google Calendar or ClickUp. There is no backlog, no project structure, no tags. A day starts from a dump and ends when the day ends. Unfinished tasks can be moved to a later day, that is all.

## The loop

1. **Dump.** Voice or text, one blob, any order. "Okay, tomorrow I need to finish my SQL assignment, I have to go grocery shopping, I need to call my mom..."
2. **Understand.** Extract tasks. For each: where it happens, what kind of work it is, how long, deadlines, fixed times. Spot relationships (three outside tasks = one outing). Ask only the 0 to 3 questions that change the plan.
3. **Prioritize + schedule.** Deadlines and fixed times first, focus work in the best window, one outing for everything outside, quick things in small gaps. Respect working hours and waking hours.
4. **Explain.** "I made 4 decisions for you", each with its reason.
5. **Execute.** Tap a task to finish it, edit it, or move it to a later day.
6. **Re-plan.** Free text or voice: "I didn't finish SQL and I have a meeting at 2." Finished tasks stay. The rest is rebuilt from now. Show what changed.

## Re-plan: the centerpiece

The Re-plan button is the primary action on the plan screen. It accepts any of:

| User says | Meaning |
| --- | --- |
| "I didn't finish SQL" | task stays, with remaining time (ask or estimate), keeps its priority |
| "I have a meeting at 2" | new fixed event, rest of day works around it |
| "I'm running 90 minutes late" | rebuild from now + delay |
| "I'm exhausted, give me a lighter afternoon" | cap non-fixed work after midday (~90 min), push the rest later |
| "I only have 3 hours today" | cap total remaining work at 180 min, drop lowest priority first |
| "I really need to finish the app today" | protect that task, drop others to make room |
| any combination | all of the above in one sentence |

Quick-tap options on the sheet: "I didn't finish something", "Running late", "Lighter afternoon", "Only 3 hours left", "I must finish the app today".

Result: a "Here is what I changed" card (serif voice), a "Now, HH:MM" marker on the thread, and "was 09:00" pills on moved tasks. Finished tasks collapse into one row.

## Voice

Voice is the hero input on the dump screen and on the re-plan sheet. Live transcript, a "Planning for tomorrow" chip when a date is spoken, and extracted tasks appearing as chips while the user is still talking. See `docs/VOICE.md`.

## Principles

1. Dump first, structure after. The first screen asks for nothing except what's on their mind.
2. Ask less, and never decide what only the user can know (workout length, deadlines, appointment times).
3. Explain every decision in one plain sentence.
4. Show relationships, not just times.
5. Re-planning is cheap and safe: nothing finished is ever lost.
6. Calm. No streaks, scores, gamification, or nagging.

## Scope for the first release (one week)

In: voice + text dump, understand with questions, plan with decisions and outing, finish/edit/move-later, re-plan (free text, voice, quick options), presets, settings (work hours, days, wake/sleep), light and dark, PWA install, offline read of today's plan. **Sign-up is required**: nobody can use the app without signing up with Google, and signing in on any device shows the same data. After signing in you may also set a password in Settings (never required). **Built in Phase 3, before the AI work:** the sign-in gate, onboarding (name, optional gender, a few screens showing what the app does) and the optional password.

Out (later): calendar import, push notifications, widgets, sharing, multi-day planning, learning from history.

## Success criteria

- Demo path takes under 30 seconds from tap to a believable day: dump (8 s) → processing (4 s) → plan appears (the thread draws down).
- Re-plan from a one-sentence instruction produces a valid plan in under 6 seconds.
- 0 invalid plans reach the UI (validator + fallback).
- 95%+ of eval cases pass (`evals/`).

## The 30-second demo (for X)

```
0:00  Tap the mic. Say a messy paragraph. Tasks appear as chips while talking.
0:08  Tap "Done talking". "Reading your list…" Two quick questions, two taps.
0:12  Build my day. The thread draws down; the outing pulls taut.
0:18  Scroll: "I made 4 decisions for you."
0:22  Tap Re-plan my day. Say: "I didn't finish SQL and I have a meeting at 2."
0:28  The day rebuilds. "Here is what I changed." Done.
```
