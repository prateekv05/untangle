# Screens

Open `design/screens/*.html` in a browser for the exact visuals (390 px wide; each file is self-contained, with the tokens inlined, so it opens correctly on its own). Live canvas: https://claude.ai/artifact/6qS5VkoponS5YTGXfKA2uQ. This file adds behaviour, states and exact copy. Components are specified in `design/DESIGN_SYSTEM.md`.

Global: top bar = mark + "Untangle" (left), settings icon button (right, `aria-label="Settings"`). Screens scroll vertically; the Re-plan dock is pinned to the bottom of the plan screen.

## Flow

```
Dump ──(mic)──▶ Listening ──▶ (thinking) ──▶ Understand ──▶ (thinking) ──▶ Plan ◀──▶ Re-plan sheet ──▶ Re-planned (a Plan)
  └──(type)────────────────────────────┘
Plan ──▶ task expanded ──▶ Edit sheet / Move later sheet / Finished
Settings sheet and Presets sheet are reachable from every screen's top bar.
Signed out (Phase 3): Welcome / sign in ──(Google, or password if set)──▶ Dump with their saved data
New account, once: Welcome ──(Google)──▶ Onboarding O1 name ▶ O2 gender ▶ O3 ▶ O4 ▶ O5 ──▶ Dump
Nobody reaches any other screen without signing in.
```

"Re-planned" is the same Plan screen with extra elements (summary card text, Now marker, was-pills, done row). Build it as one screen with a `replanned` state, not two screens.

## 1. Dump (`01-dump.html`)

Purpose: get everything out of the user's head. Nothing else competes.

- Heading: "What's on your mind?" Sub: "Say it or type it, in any order. I'll untangle it."
- Dump box (surface, radius-lg, 290 px min height): textarea (20/30), live count "7 things so far", mic button 68 px bottom-right (`aria-label="Tap to talk"`).
- "Quick starts, optional": chips Call, Buy, Go to, Order, Email + "+ Yours" (dashed). Tapping a chip inserts the verb on a new line and focuses the textarea. "+ Yours" opens the Presets sheet. (Chips for user presets appear first.)
- Primary button at the bottom: "Untangle my day". Disabled until at least one task is detected (count ≥ 1).
- Carry-over card (only if tasks were moved to today): "Carried over: Gym, Buy toothpaste." with "Add" per item. Sits above the dump box.
- Examples (dev/demo only, behind `?demo=1`): "Try an example", "With an appointment".

States: empty (placeholder: "SQL assignment, gym, groceries, call Mom, send resume to Sarah, work on my app, buy toothpaste…"), typing, mic permission, error (text stays).

## 2. Listening (`02-listening.html`)

- Top: close (X) left, "Listening" centre, timer `0:24` right (tabular).
- Chip: "Planning for tomorrow, Friday" when a date is detected.
- Live transcript (21/30, weight 500). The newest phrase is `ink-muted` until final.
- Waveform: 25 bars, animated; static under `prefers-reduced-motion`.
- "Six things so far." (serif voice) + heard-so-far chips (location dot + title).
- Stop button 76 px (square icon) with label "Done talking". Tapping it → thinking.
- Close discards the recording. Auto-stop at 120 s with the toast "That's the limit. I'm working with what I heard."

## Thinking (shared)

Full-screen, left aligned, `display` title and 3 to 4 steps that tick on in order with a small spinner then a filled green dot.
- After dump: title "Reading your list". Steps: "Reading N things", "Working out where each one happens", "Finding what belongs together".
- After Understand: title "Untangling your day". Steps: "Looking at N tasks", "Bundling N outside tasks into one outing" (or "Checking what needs you out"), "Fitting around 09:00 to 17:00" (or "Spreading the day out"), "Writing down why".
Steps reflect real progress where possible; otherwise are time-based but never exceed the actual wait by more than a second. If the call returns early, jump to the result.

## 3. Understand (`03-understand.html`)

- Heading: "Here's what I understood". Sub: "Tap anything that's off to fix it."
- **QuestionCard** (only if `questions.length > 0`): ask-tint card, heading "One quick question" / "Two quick questions" / "Three quick questions", serif line "I can plan without these, but I'd be guessing." Each question is one tap:
  - due: chips Today, Tomorrow, This week, No deadline
  - duration: chips 45 min, 1 h, 1 h 30 min, Not sure (Not sure keeps the estimate)
  - time: time input + "Set time" + "Not sure"
  Answered questions disappear. No question ever repeats.
- **Relationship card** (if ≥2 outside tasks): green dashed card, task pills joined by "+", serif line "All outside, so this becomes one outing instead of 3 trips." If there is an outside fixed appointment: "You're out for your dentist anyway, so I'll chain the rest right after it."
- Day mode segmented control: Workday | Day off. Default from `settings.workDays` and the planned date.
- Task rows: name, remove (X, 44 px target), WhereTag with chevron (opens a 4-option menu), time chip (Auto dashed / How long? pink for health and deep with estimated durations / set), fact pills ("Fixed at 17:00", "Due tomorrow").
- "+ Forgot something? Add it" expands into the add card: text input, preset chips, Where options, How long select, "Add task". The guess updates live as the user types.
- Primary: "Build my day". Quiet link: "Edit my list" (back to Dump, keeps text).

## 4. Plan (`04-plan.html`, dark: `07-plan-dark.html`)

- Heading: weekday, month day ("Thursday, October 1"). Sub: "Day off. Planned at 08:30." / "Workday. Planned at 08:30."
- **Decisions card** (ink): serif headline "I made N decisions for you" (N = decisions shown, max 5 visible; 6th hidden), then the lines, then the note if present. After tasks are finished the headline becomes "N of M done" and the lines stay.
- **Timeline** (the Thread): rows of time, spine with node, TaskBlock. Work-hours markers ("Work starts 09:00", "Work ends 17:00") on workdays, drawn as thin labelled rules.
- **Outing**: one dashed green group, header "One outing", "3 stops, about 2 h 15 min"; taut green spine; serif hops between stops.
- **TaskBlock**: tap anywhere on the card to expand; tap the circle to finish immediately. Expanded: Finished, Edit, Move later (44 px). Only one expanded at a time.
  - Finished: name struck through, circle filled green, progress updates, block stays in place. Tap again to undo.
  - Edit: sheet with name, Where options, How long, Fixed time (optional). "Save and re-plan". "Delete task" link. Saving re-plans only unfinished tasks.
  - Move later: sheet with Tomorrow, the next two weekdays, Next week, or a date picker. Toast "Gym moved to Tomorrow" with Undo (5 s). The task leaves the timeline and appears under "Moved to a later day" with "Bring back".
- "Didn't fit today" box lists dropped tasks with their reasons.
- "+ Forgot something? Add it" below the timeline; adding re-plans.
- **Dock** (pinned): serif line "Plans change. Tell me what happened.", mic button 52 px, primary "Re-plan my day" with refresh icon.

Motion (one orchestrated moment): the spine draws down, blocks arrive along it with ~180 ms stagger, the outing pulls taut last. Re-plan and edits update in place without replaying the entrance. Reduced motion: final state immediately.

## 5. Re-plan sheet (`05-replan-sheet.html`)

- Title "What changed?" Serif line: "It's 11:45. Tell me, and I'll rebuild what's left of your day." (live clock)
- Text box with mic (56 px). Mic fills the box; the user can edit before sending. No auto-submit.
- "Or tap one": chips "I didn't finish something", "Running late", "Lighter afternoon", "Only 3 hours left", "I must finish the app today". Chips that need a target ("I didn't finish something", "I must finish the app today") open a one-step picker of today's open tasks; "Running late" offers 30 min, 1 h, 90 min, 2 h. Chips fill the text box with a sentence, so the user can combine them.
- Primary: "Re-plan my day". Serif note: "Finished tasks stay put."
- Empty text: button disabled.
- Failure: toast "I couldn't rebuild that. Your plan is unchanged." (plan stays as is)

## 6. Re-planned (`06-replanned.html`)

Same screen as Plan, with:
- Heading "Re-planned at 11:45", sub: `You said: "…"` (user's words, sans).
- Decisions card headline "Here is what I changed", 3 to 5 lines.
- A done row: "1 finished: Send resume to Sarah" (collapsed; tap to expand the list).
- "Now, 11:45" marker on the thread (ink, not a location colour).
- "was 09:00" pills on moved tasks; "Fixed at 14:00" on new events.
- Undo: toast "Re-planned. Undo" for 8 s restores the previous plan version.

## Welcome and sign in (Phase 3; `design/screens/08-welcome.html`)

The only screen a signed-out visitor can see. Mark and "Untangle", one serif line ("Turn a messy list into a realistic day."), a primary "Continue with Google", and a quiet "Sign in with a password" link that reveals email and password fields (used only by accounts that set a password). First-time and returning users use the same Google button: Google creates the account if it is new, or signs in to the existing one. Copy under the button: "Your days are saved to your account, so they follow you to any device." Errors: wrong password or unknown email both show "That didn't match. You can also continue with Google."; Google failure or cancel shows "I couldn't sign you in. Try again." No skip, no guest mode.

## Onboarding (Phase 3; `design/screens/09-onboarding-*.html`)

Shown once, right after a new account's first sign-in, when `users.onboarded_at` is null. A returning user never sees it. No top-bar settings button. Progress of 5 dots, a quiet "Skip" on the three explainer screens (name is required; skipping explainers is fine), a real "Back" everywhere (Back from O1 does nothing; the user is already signed in). Every screen works with one hand at 390 px and with the keyboard. Copy in Untangle's own voice (serif) is only the explainer sentences; headings and controls are sans.

| Screen | Content |
| --- | --- |
| O1 Name | Heading "What should I call you?" Sub: "Just a first name is fine." One text input (label "Your name", prefilled from Google), Continue disabled until non-empty. |
| O2 Gender | Heading "How do you identify?" Sub: "Optional. I don't use this to plan your day." Four single-select options: Woman, Man, Non-binary, Prefer not to say. Continue is enabled with nothing selected (stored as null). |
| O3 Dump | Mini illustration of the dump box with chips. Heading "Say everything on your mind." Serif line: "Talk or type it in any order. I'll sort out what it is and what belongs together." |
| O4 Plan | Mini illustration of the thread with an outing. Heading "Get a day you can actually do." Serif line: "Every choice comes with a reason, and I only ask when the answer changes your plan." |
| O5 Re-plan | Mini illustration of the re-plan sheet. Heading "When life changes, just say so." Serif line: "Tell me in plain words and I'll rebuild the rest of your day. Finished things stay put." Primary: "Start" (sets `onboarded_at`, goes to Dump). |

The Dump heading may greet the user by name only if it fits the existing copy ("What's on your mind, Sam?").

## Settings sheet

Account row (Phase 3): the name and email, with "Sign out" (which returns to Welcome). Name is editable. "Password" row, optional. Not set: "Set a password" with the hint "Optional. You can always sign in with Google." Set: "Change password" and "Remove password". New password needs at least 10 characters, with a show/hide toggle; no other composition rules.

Working hours (two time inputs), Working days (7 toggles Mo..Su), Awake from / until, Presets (count, opens Presets sheet), Appearance (Light / Dark / System), privacy line "Your voice is turned into text and then discarded." Save.

## Presets sheet

Make your own: word or phrase, Where, Type (Focus work, Quick task, Errand, Call, Exercise, Chore), Time (or "Time: ask me each time"). Lists "Yours" (deletable) and "Built in": Call, Go to, Buy, Order, Organise, Email, Pay, Book, Clean, Work on. A user preset like "Gym = Outside, Exercise, 90 min" makes every "Gym…" task correct with no questions.

## Empty, error and offline states

| Situation | Copy |
| --- | --- |
| Nothing left today | "Nothing left for today. Add something below, or bring back a task you moved." |
| Dump too short | button stays disabled; no error |
| Mic blocked | "Microphone is blocked. You can still type." |
| No speech heard | "I didn't catch anything. Try again, or type it." |
| AI/network failure on Understand | "I couldn't read that just now. Your text is saved. Try again." with a Retry button |
| Offline | plan opens from cache; edit actions disabled with "You're offline." |
| Daily limit | "You've used today's untangles. They reset tomorrow." |

## Accessibility checklist

Every control is a real `<button>`/`<input>` with a label; icon-only buttons have `aria-label`; sheets trap focus and close on Escape; toasts use `role="status"`; the spine and nodes are decorative (`aria-hidden`) because each block states its time and WhereTag in text; Re-plan changes announce via `aria-live="polite"` ("Re-planned. 4 things changed."); contrast per tokens (text on tints uses `*-ink`).
