# Untangle: Product Requirements Document

## 1. Overview

**Untangle turns a messy list of things you need to do into a realistic day by understanding the relationships between them.**

Untangle is a phone-first progressive web app (PWA). The user dumps everything on their mind by voice or text, in any order. Untangle works out what each item is, what depends on what, what belongs together and what matters most. It then lays out a realistic day with a plain-language reason for every decision. When the day changes, the user says so in plain words and Untangle rebuilds the rest of the day.

**Core loop:** dump, understand, prioritize, schedule, execute, re-plan. Re-plan is the centerpiece.

**Signature moment:** "I figured out these things belong together."

## 2. Problem

People start the day with a loose pile of obligations: errands, deadlines, calls, focus work, appointments. Existing tools fail them in two ways.

1. **They ask for structure first.** Task managers and calendars make the user categorize, tag, estimate and slot everything before any value appears.
2. **They break when the day does.** A plan made at 8:00 is wrong by 11:00. Most tools leave the user to drag blocks around by hand or abandon the plan.

Neither approach notices that three errands in the same neighborhood should be one trip, or that a deep-focus task belongs in the user's best window and not between two meetings.

## 3. Target user

Busy people, such as students, knowledge workers and freelancers, who manage their day in their head or in scattered notes. They:

- think in a stream, not in a structure
- have a mix of fixed commitments and flexible work
- have days that regularly change mid-stream
- are on their phone first

## 4. Product principles

1. **Dump first, structure after.** The first screen asks for nothing except what is on the user's mind.
2. **Explain every decision.** Each scheduling choice has one plain, first-person sentence of reasoning. No reason, no block.
3. **Never decide what only the user can know.** Workout length, deadlines and appointment times are asked about, not guessed. Anything guessed is visibly marked as an estimate until the user sets it.
4. **Ask less.** At most three questions, only when the answer changes the plan, one tap each.
5. **Show relationships.** Tasks that belong to one trip are shown as one outing, not a flat list.
6. **Re-planning is cheap and safe.** Finished tasks never move or disappear. Everything else is rebuilt from now.
7. **Stay calm.** No streaks, scores, gamification or nagging.

## 5. Goals and non-goals

### Goals

- Take a user from a messy dump to a believable, realistic day in under 30 seconds.
- Make re-planning from a single sentence the fastest way to recover a derailed day.
- Build trust through visible reasoning and honest uncertainty.

### Non-goals

Untangle is not a task manager, calendar, project tool or scheduling assistant. It does not compete with Todoist, Notion, Motion, Sunsama, Google Calendar or ClickUp. The product does not include:

- lists, projects, tags, labels or subtasks
- recurring tasks
- calendar grid views
- collaboration or sharing
- notes
- third-party integrations

A day is created from a dump and lives for that day. Unfinished tasks can be moved to a later day, and that is all.

## 6. User experience

### 6.1 The core flow

1. **Dump.** The user speaks or types one blob of text. Example: "Tomorrow I need to finish my SQL assignment, go grocery shopping, call my mom, and send my resume to Sarah."
2. **Understand.** Untangle extracts tasks and, for each one, determines where it happens, what kind of work it is, how long it takes, any deadline and any fixed time. It spots relationships and asks 0 to 3 clarifying questions.
3. **Plan.** Deadlines and fixed times go first. Focus work goes in the best window. Everything outside the home becomes one outing. Quick tasks fill small gaps. The plan respects working hours and waking hours.
4. **Explain.** A summary card states "I made N decisions for you", each with its reason.
5. **Execute.** The user taps a task to finish it, edit it or move it to a later day.
6. **Re-plan.** The user describes what changed and the rest of the day is rebuilt.

### 6.2 Screens

| Screen | Purpose |
| --- | --- |
| Welcome and sign in | Continue with Google, or sign in with a password if the user has set one. The only screen visible to signed-out visitors. |
| Onboarding | Shown once to new accounts. Collects a name (required) and an optional gender, then three short explainer screens. |
| Dump | A single text box with a prominent mic button, quick-start chips (Call, Buy, Go to, Order, Email, plus user-defined) and a live count of detected tasks. |
| Listening | Live transcript, waveform, a "Planning for tomorrow" chip when a date is spoken, and extracted tasks appearing as chips while the user is still talking. |
| Understand | Confirms what was understood. Shows at most three one-tap questions, relationship cards (for example "all outside, so this becomes one outing instead of 3 trips") and editable task rows. |
| Plan | A vertical timeline (the "thread") of task blocks, one dashed group for the outing, the decisions card, a "Didn't fit today" box and a pinned Re-plan dock. |
| Re-plan sheet | Free-text or voice input plus quick-tap options. Produces the re-planned day. |
| Settings | Name, working hours and days, waking hours, presets, appearance (light, dark, system), optional password, sign out. |
| Presets | User-defined shorthands, for example "Gym = outside, exercise, 90 min", so those tasks are planned correctly with no questions. |

### 6.3 Re-plan (the centerpiece)

Re-plan is the primary action on the plan screen. It accepts natural language, alone or combined in one sentence.

| The user says | Untangle does |
| --- | --- |
| "I didn't finish SQL" | Keeps the task with its remaining time and original priority. |
| "I have a meeting at 2" | Adds a fixed event and plans around it. |
| "I'm running 90 minutes late" | Rebuilds from now plus the delay. |
| "I'm exhausted, give me a lighter afternoon" | Caps non-fixed afternoon work at about 90 minutes and pushes the rest later. |
| "I only have 3 hours today" | Caps remaining work at 180 minutes and drops the lowest priority first. |
| "I really need to finish the app today" | Protects that task and drops others to make room. |

Quick-tap chips are also offered: "I didn't finish something", "Running late", "Lighter afternoon", "Only 3 hours left", "I must finish the app today".

**Result:** a "Here is what I changed" card, a "Now" marker on the thread, "was 09:00" pills on moved tasks, and finished tasks collapsed into one row. The user can undo a re-plan for 8 seconds.

### 6.4 Voice

Voice is the hero input on the Dump screen and the Re-plan sheet. The browser's built-in speech recognition is used where supported, with a server-side transcription fallback. Recordings are capped at 120 seconds. Audio is never stored. Only the resulting transcript is kept.

## 7. Functional requirements

### 7.1 Input and understanding

- **FR-1.** Accept free-form dumps by text or voice, up to 4,000 characters.
- **FR-2.** Extract discrete tasks from the dump, with a live count while typing.
- **FR-3.** For each task, infer the location type (outside, work, home or anywhere), the task kind, a duration, any deadline and any fixed time.
- **FR-4.** Mark any inferred duration as an estimate, visually distinct, until the user sets it.
- **FR-5.** Ask at most 3 clarifying questions, only when the answer changes the plan. Each is answerable in one tap, and no question is repeated.
- **FR-6.** Detect relationships between tasks, such as multiple outside tasks forming one outing or chaining after an outside appointment, and surface them to the user.
- **FR-7.** Detect a spoken or written target date, such as "tomorrow", and plan for that day.
- **FR-8.** Let the user correct anything before planning: remove a task, change where it happens, change its duration, add a forgotten task.

### 7.2 Planning

- **FR-9.** Produce a schedule in which fixed-time items are honored exactly, deadlines are respected, focus work sits in the best available window, outside tasks are bundled into one outing, and quick tasks fill small gaps.
- **FR-10.** Respect the user's working hours, working days and waking hours. Support a "Workday" or "Day off" mode per plan.
- **FR-11.** Attach a one-sentence, first-person reason to every scheduled block.
- **FR-12.** List tasks that did not fit, with the reason each was dropped.
- **FR-13.** Every plan must pass deterministic validation before the user sees it. If the AI's plan is invalid, the system attempts one automatic repair and then falls back to a rule-based planner. The user never sees an invalid plan or an error screen caused by a bad AI response.

### 7.3 Execution

- **FR-14.** Tap a task to expand it. Tap its circle to finish it immediately. Finishing can be undone.
- **FR-15.** Edit a task's name, location, duration and fixed time. Saving re-plans only unfinished tasks.
- **FR-16.** Move a task to a later day: tomorrow, the next two weekdays, next week or a chosen date. This has a 5-second undo. Moved tasks are listed and can be brought back. They surface as "Carried over" on the Dump screen of the target day.
- **FR-17.** Delete a task.
- **FR-18.** Add a forgotten task at any time, which triggers a re-plan.

### 7.4 Re-planning

- **FR-19.** Accept free text, voice or quick-tap options, individually or combined.
- **FR-20.** Never move or remove finished tasks. Rebuild everything else from the current time.
- **FR-21.** Summarize what changed and why, and mark moved tasks with their previous time.
- **FR-22.** If a re-plan fails, leave the existing plan unchanged and say so.

### 7.5 Accounts and settings

- **FR-23.** Sign-in is required. Google sign-in is the primary method, and an account's data is available on any device.
- **FR-24.** Users may optionally set a password (minimum 10 characters) as an additional sign-in method. It is never required.
- **FR-25.** A short, one-time onboarding collects a first name and an optional gender. Gender is never used for planning.
- **FR-26.** Settings: working hours, working days, waking hours, appearance (light, dark or system), presets, password, sign out.
- **FR-27.** Presets let users define shorthand tasks with a location, task kind and duration (or "ask me each time").

### 7.6 Platform

- **FR-28.** Installable as a PWA, with an offline shell. Today's plan opens from cache when offline. Editing is disabled offline with a clear message.
- **FR-29.** Phone-first layout, designed at 390px width, with full light and dark themes.
- **FR-30.** AI calls are rate limited per user per day. When the limit is reached, the user sees a clear, calm message.

## 8. Voice and design requirements

### Two voices

- **User content and all controls** use a clean sans-serif (Schibsted Grotesk).
- **Everything Untangle itself says**, such as reasons, decisions, hints and re-plan summaries, uses an upright serif (Newsreader). The serif is never used for headings, labels or buttons.

### Color means where

| Color | Meaning |
| --- | --- |
| Green | Outside |
| Blue | Work |
| Amber | Home |
| Grey | Anywhere |
| Pink | "Ask": Untangle needs the user |

No other element uses these colors.

### Visual and interaction rules

- No italics, no emoji, no exclamation marks. Sentence case throughout.
- Times are 24-hour `HH:MM`. Durations read `45 min`, `1 h 30 min`.
- Only sheets and the toast cast shadows.
- No colored left-border stripes on cards. Location is shown by the node on the thread and a location tag.
- Touch targets are at least 44px, with visible focus rings. Reduced-motion preferences are respected.
- One orchestrated motion moment: the spine draws down, blocks arrive along it, and the outing pulls taut last. Updates after that happen in place.
- Icons are inline SVG.

### Accessibility

Every control is a real button or input with a label. Sheets trap focus and close on Escape. Toasts use `role="status"`. Re-plan results are announced to screen readers. Decorative elements are hidden from assistive technology, and text contrast meets the design tokens.

## 9. AI behavior requirements

- **The model proposes, code disposes.** Model output is always parsed against a strict schema and passed through the deterministic validator.
- Model choice is swappable at runtime and configured through environment settings. Supported providers are Anthropic and OpenAI. The model used is logged and stored on every AI call and every saved plan.
- Prompts are maintained as separate files, not embedded in code.
- AI responses are structured output validated by Zod schemas. No free-form text drives the UI.
- A quality evaluation suite measures plan validity and behavior against a library of test cases.

## 10. Privacy and security

- Audio is never stored. Voice is transcribed to text and discarded.
- Transcripts are stored only as the raw dump of the day they belong to.
- Secrets live only on the server and are never sent to the client or logged.
- Every API route requires an authenticated user and validates its input.
- Password sign-in is rate limited. Passwords are hashed with scrypt.
- Privacy line shown in Settings: "Your voice is turned into text and then discarded."

## 11. Success metrics

| Metric | Target |
| --- | --- |
| Time from tap to a believable day (dump, processing, plan) | Under 30 seconds |
| Re-plan from one sentence to a valid plan | Under 6 seconds |
| Invalid plans reaching the UI | 0 |
| AI evaluation cases passing | 95% or more |
| Clarifying questions per dump | At most 3, and none when the answer would not change the plan |

## 12. The 30-second demo

```
0:00  Tap the mic. Say a messy paragraph. Tasks appear as chips while talking.
0:08  Tap "Done talking". "Reading your list…" Two quick questions, two taps.
0:12  Build my day. The thread draws down; the outing pulls taut.
0:18  Scroll: "I made 4 decisions for you."
0:22  Tap Re-plan my day. Say: "I didn't finish SQL and I have a meeting at 2."
0:28  The day rebuilds. "Here is what I changed." Done.
```

## 13. Out of scope for the first release

Calendar import, push notifications, home-screen widgets, sharing, multi-day planning and learning from history.

## 14. Technology summary

| Area | Choice |
| --- | --- |
| Front end | Next.js (App Router), TypeScript, Tailwind CSS driven by design tokens |
| PWA | Serwist (service worker, offline shell, install prompt) |
| AI | Vercel AI SDK with Anthropic and OpenAI models, structured output via Zod |
| Speech to text | Browser Web Speech API first, OpenAI Whisper on the server as fallback |
| Data | Neon Postgres with Drizzle ORM |
| Auth | Auth.js with Google OAuth and optional password |
| Testing | Node's built-in test runner for planner and validator logic, Playwright for the end-to-end demo path |
| Hosting | Vercel |

## 15. Open questions

- Which model combination gives the best balance of plan quality, speed and cost? This is to be settled by running the evaluation suite across the supported models.
- How should carried-over tasks be prioritized against a new dump on the following day?
