# Untangle design system

Source of truth for all UI. Live version: https://claude.ai/artifact/ThRUFMYjDbZCx4EvErhWLe

Tokens: `design/tokens.json` (source) and `design/tokens.css` (compiled CSS variables for light and dark). Never write a raw hex in app code: use the variables.

---
# Untangle

Untangle turns a messy list of things to do into a realistic day, and says why it made each choice. This system styles the Untangle app: a phone-first PWA where you dump your list, answer one or two questions, and get a day laid out on a single thread.

It is built on one idea: **a tangle becomes a line.** Everything visual comes from that: a thread that runs down the timeline, errands that are pulled taut into one outing, and a voice that explains what was straightened out.

## Principles

1. **Colour means where.** Four thread colours mark location (Outside, Work, Home, Anywhere) and nothing else. A pink "ask" colour marks the rare moments Untangle needs you. No other colour carries meaning.
2. **Two voices.** What the user wrote, and every control, is set in Schibsted Grotesk. Everything Untangle itself says about the day (reasons, decisions, hints) is set in Newsreader, an upright serif. A reader can always tell whose words they are reading. The voice is never italic.
3. **Show the relationship, not just the time.** Grouped tasks share one thread. If two things belong together, the design joins them.
4. **Never decide what only the user can know.** A workout's length is the user's. Anything Untangle guessed is flagged in the ask colour until the user sets it.
5. **Ask less.** Questions appear only when the answer changes the plan. They are one tap each.

## Content fundamentals

- Untangle speaks in the first person, plainly: "I put Call mom in your lunch break." Never "AI", "algorithm" or "optimised".
- Sentence case everywhere. No all caps, no exclamation marks, no emoji.
- Say the reason, not the rule. Good: "You're already out at the gym, so this goes on the way back home. No second trip." Bad: "Task clustered by location."
- Buttons say what happens: **Untangle my day**, **Build my day**, **Rebuild my day**, **Finished**, **Move later**. The same action keeps the same name in its toast ("Moved to Tomorrow").
- Empty and failed states give a direction: "Nothing left for today. Add something below, or bring back a task you moved."
- Times are 24-hour, `HH:MM`. Durations: `45 min`, `1 h 30 min`.

## Visual foundations

**Colour.** A cool lilac-grey `ground` with white `surface` cards and one deep indigo-black `ink`. The four thread colours each come as three tokens: `thread-*` (nodes, lines, borders: non-text), `*-ink` (text) and `*-tint` (fills). Use the matching trio together, never mix them. Light and dark themes are both first class. No gradients. No coloured left-border stripes on cards: location is shown by the node on the spine and the tag, not a stripe.

**Type.** Schibsted Grotesk carries everything except Untangle's voice. One `display` size per screen. Times use `time` with tabular numerals. Newsreader, upright and never italic (`voice`, `voice-lg`, `voice-sm`), is reserved for sentences Untangle wrote. Do not use the serif for headings, labels or buttons.

**The Thread.** The signature element. A 2px `line` spine runs down the left of the timeline; each task hangs a 12px node on it, coloured by `thread-*` for its location, ringed in `ground`. When tasks belong to one outing, the spine between them thickens to 5px `thread-outside` with rounded caps: the thread pulled taut. Wrap those stops in the One outing group (`radius-lg`, dashed `thread-outside` border, `outside-tint` at low strength) with its header.

**Space and shape.** 4px base. Screen padding `space-5`. Cards `radius-md`, groups and sheets `radius-lg`, tags and chips `radius-pill`. Borders are 1px `line`. Only sheets and the toast cast `shadow-lift`.

**Motion.** One orchestrated moment: when the plan appears, the thread draws down the screen and each block arrives along it, the outing pulling taut last. Everything else answers a touch (expand, check, dismiss) in 150 to 250ms. Honour `prefers-reduced-motion`: show the final state.

**Touch and focus.** Targets at least 44px. Focus ring: 2px `focus`, 2px offset. Real `<button>`, `<input>` + `<label>` always.

## Iconography

Inline SVG, 20px, 1.75px stroke, round caps and joins, stroked in `ink-muted` or `ink`. A handful only: settings, close, check, chevron. No filled icons, no emoji. The brand mark is in `assets/Logo`.

## Components

| Component | Use it for |
| --- | --- |
| Button | Primary, secondary and quiet actions. One primary per screen. |
| WhereTag | Location tags, the time chip (auto / How long? / set), and fact pills. |
| TaskBlock | One task on the timeline: node, time, name, tags, Untangle's reason, actions. |
| Outing | The grouped stops of one outing on a taut thread. |
| Decisions | The summary card: "I made N decisions for you". |
| QuestionCard | The one or two questions Untangle needs answered. |
| Sheet | Bottom sheets (Running behind, Move later, Edit) and the toast. |

## What the consumer provides

Load Schibsted Grotesk (400 to 700) and Newsreader (400 and 500, upright only) from Google Fonts, set `data-theme` on `<html>` to `light` or `dark`, and read tokens through the generated `tokens.css`. The components are specifications with live previews; build them in your framework using these tokens and classes.

## Accessibility

Text on tints uses the `*-ink` token: at least 4.5:1 in both themes. `thread-*` colours are for non-text marks and meet 3:1 on `surface`. The four locations also differ by label, never colour alone.


---

## Component: Button

Buttons start an action and say exactly what it does. Use one primary (`ink` fill, `ink-inverse` text, `radius-md`, 48px tall) per screen: Untangle my day, Build my day, Save and re-plan. Secondary is a 1px `line` outline. The quiet link (`ink-muted`, underlined, `small`) is for the way back: Edit my list. The pill button (`radius-pill`, `surface` fill) is for in-flow actions such as Running behind? Disabled uses 35% opacity and never hides the label. The same action keeps its name in the toast that follows.


---

## Component: WhereTag

A WhereTag names where a task happens: Outside, Work, Home or Anywhere. It is a `radius-pill` with a 7px dot in `thread-*`, a `*-tint` fill and `*-ink` text. Location is the only thing these four colours ever mean. The time chip has three states. **Auto**: dashed, muted, a safe estimate. **How long?**: `ask-tint` with `ask` border, shown only on tasks whose length only the user knows (workouts, focus work) until they set it. **Set**: solid, the user's number. Fact pills (`surface-soft`, `ink-muted`) carry facts the user gave: a fixed time, a deadline.


---

## Component: TaskBlock

A TaskBlock is one task on the Thread. Left to right: the clock time (`time` style, `ink-muted`), the spine with a 12px node in the task's `thread-*` colour (ringed in `ground`), and a `surface` card with a 1px `line` border at `radius-md`. In the card: the task name (`body-strong`), the WhereTag and duration, then Untangle's reason in a `surface-soft` note set in `voice`. Tapping the card reveals three 44px actions: Finished, Edit, Move later. Finished strikes the name through and fills the check with `thread-outside`; the block stays where it was. Do not add a coloured left stripe: the node carries location.


---

## Component: Outing

The Outing shows that several tasks belong to one trip out of the house. It wraps the stops in a `radius-lg` group with a 1.5px dashed `thread-outside` border on `outside-tint`, headed "One outing" (`title`, `outside-ink`) with the stop count and total time. Inside, the spine thickens to 5px `thread-outside` with rounded caps: the thread pulled taut. Between stops, a short `voice` line names the relationship ("on the way back", "next stop", "right after your dentist"). An outside appointment with a fixed time is the first stop; the other outside tasks chain after it. Only ever one Outing per day.


---

## Component: Decisions

Decisions is the explain screen's anchor: an `ink` card at `radius-lg` whose headline and every line are set in `voice` (Untangle's own words). The headline counts the decisions ("I made 4 decisions for you"); each line is one choice with its reason, up to five. Once something is finished the headline changes to progress ("3 of 8 done") but the lines remain. Anything Untangle guessed gets a closing note in `voice-sm`. Text is `ink-inverse` on `ink` in both themes.


---

## Component: QuestionCard

QuestionCard asks only what changes the plan. It uses the ask colours (`ask-tint` ground, `ask-ink` heading) so it reads as "Untangle needs you", with a one-line reason in `voice`. Each question is one tap: a deadline is four chips (Today, Tomorrow, This week, No deadline); a fixed time is a time input with Set time and Not sure. Show at most three. Never ask for something Untangle can estimate; never ask twice. Answered questions disappear and the plan updates.


---

## Component: Sheet

Sheets slide up from the bottom for secondary tasks: Running behind, Move to a later day, Edit task, Settings. `surface` fill, `radius-lg` top corners, a 40px grab bar, `title` heading and a `voice` line saying what will happen. Options are 52px full-width rows on `surface-soft`. Sheets and the toast are the only elements that cast `shadow-lift`. The toast confirms an action in the same words as its button, offers Undo for five seconds, and sits above the content on `ink`.
