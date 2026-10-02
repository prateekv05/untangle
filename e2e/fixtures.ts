import { test as base, expect } from "@playwright/test";
import { fixtureTasksFor } from "../src/fixtures/example";
import { diffStarts, planDay } from "../src/lib/planner";
import { changeLines, planReplanChanges } from "../src/lib/replan";
import { toHHMM, toMin } from "../src/lib/time";
import { activeTasks, keptBlocksFor, resolveMoveTarget, type DayRow } from "../src/lib/day-edit";
import { DEFAULT_SETTINGS, type Plan, type ReplanConstraints, type Task } from "../src/lib/schemas";
import { deriveQuestions, tasksFromText } from "../src/lib/guess";
import { createUser, deleteCreatedUsers, signInAs, type TestUser } from "./support";

/** `test` with a signed-in, onboarded account (no name, so headings read "What's on your mind?"). */
export const test = base.extend<{ user: TestUser; understandStub: void }>({
  // The screens tests exercise the UI, not the model: /api/understand and /api/plan answer from the Phase 1 fixtures and planDay(). The real routes have their own tests.
  understandStub: [
    async ({ page }, use) => {
      const ids = new Map<string, string>(); // title -> fixture id: the client sends no ids it made up, so the stub puts them back
      await page.route("**/api/understand", async (route) => {
        const { text } = route.request().postDataJSON() as { text: string };
        const tasks = fixtureTasksFor(text) ?? tasksFromText(text, []);
        tasks.forEach((t) => ids.set(t.title, t.id));
        await route.fulfill({ json: { dayId: "stub", date: "2026-10-03", mode: "workday", planFor: "today", tasks, questions: deriveQuestions(tasks), groupings: [], model: "stub" } });
      });
      // The saved day, kept in memory: the edit and undo routes work on it like the real ones (planDay instead of the model).
      let rows: DayRow[] = [];
      let plans: Plan[] = [];
      let mode: "workday" | "dayoff" = "workday";
      const view = () => ({ dayId: "stub", mode, tasks: rows.filter((r) => r.status !== "deleted"), plan: plans.at(-1)!, version: plans.length, source: "fallback", model: null, plannedAt: "08:30" });
      const replan = () => {
        const kept = keptBlocksFor(plans.at(-1) ?? null, rows);
        plans.push(planDay(activeTasks(rows), DEFAULT_SETTINGS, { mode, minStart: kept.length ? 8 * 60 + 30 : undefined, fixedBlocks: kept }));
      };
      await page.route("**/api/plan", async (route) => {
        const body = route.request().postDataJSON() as { mode: "workday" | "dayoff"; tasks: Array<Omit<Task, "id"> & { id?: string }> };
        const tasks: Task[] = body.tasks.map((t, i) => ({ ...t, id: t.id ?? ids.get(t.title) ?? `n${i + 1}` }));
        mode = body.mode;
        rows = tasks.map((t) => ({ ...t, status: "open", movedTo: null }));
        plans = [planDay(tasks, DEFAULT_SETTINGS, { mode: body.mode })];
        await route.fulfill({ json: { plan: plans[0], tasks, mode: body.mode, source: "fallback", model: null, version: 1, plannedAt: "08:30" } });
      });
      await page.route("**/api/day", async (route) => route.fulfill({ json: { date: "2026-10-03", day: null, carried: [] } }));
      await page.route("**/api/tasks/*", async (route) => {
        const id = route.request().url().split("/").pop()!;
        const { status } = route.request().postDataJSON() as { status: "open" | "done" };
        rows = rows.map((r) => (r.id === id ? { ...r, status } : r));
        await route.fulfill({ json: rows.find((r) => r.id === id) });
      });
      await page.route("**/api/day/edit", async (route) => {
        const { op } = route.request().postDataJSON() as { op: { type: string; taskId: string; patch?: Partial<Task>; task?: Omit<Task, "id">; to?: string } };
        if (op.type === "edit") rows = rows.map((r) => (r.id === op.taskId ? { ...r, ...op.patch } : r));
        if (op.type === "delete") rows = rows.map((r) => (r.id === op.taskId ? { ...r, status: "deleted" } : r));
        if (op.type === "add") rows = [...rows, { ...op.task!, id: `n${rows.length + 1}`, status: "open", movedTo: null }];
        if (op.type === "move") rows = rows.map((r) => (r.id === op.taskId ? { ...r, status: "moved", movedTo: resolveMoveTarget(op.to!, "2026-10-03") } : r));
        if (op.type === "bringBack") rows = rows.map((r) => (r.id === op.taskId ? { ...r, status: "open", movedTo: null } : r));
        replan();
        await route.fulfill({ json: view() });
      });
      // The real route reads the sentence with the model; the stub reads a few known phrases, then runs the same pure rules and planDay().
      await page.route("**/api/replan", async (route) => {
        const { instruction } = route.request().postDataJSON() as { instruction: string };
        const t = instruction.toLowerCase();
        const c: ReplanConstraints = { now: "11:45", doneTaskIds: [], unfinished: [], newEvents: [], capacityMin: null, lighterAfter: null, mustFinishTaskIds: [], dropTaskIds: [], delayMin: null };
        if (t.includes("didn't finish sql")) c.unfinished.push({ taskId: "sql", remainingMin: null });
        if (t.includes("meeting at 2")) c.newEvents.push({ title: "Meeting", start: "14:00", durationMin: 60, location: "work" });
        if (t.includes("lighter")) c.lighterAfter = "12:00";
        if (t.includes("must finish the app")) c.mustFinishTaskIds.push("app");
        if (!c.unfinished.length && !c.newEvents.length && !c.lighterAfter && !c.mustFinishTaskIds.length) return route.fulfill({ status: 502, json: { error: "replan_failed" } });
        const previous = plans.at(-1)!;
        const changes = planReplanChanges(c, rows, previous, toMin("11:45"));
        rows = rows.map((r) => (changes.reopen.includes(r.id) ? { ...r, status: "open" } : r));
        const added: Task[] = changes.newEvents.map((e, i) => ({ ...e, id: `ev${i + 1}` }));
        rows = [...rows, ...added.map((a): DayRow => ({ ...a, status: "open", movedTo: null }))];
        const kept = keptBlocksFor(previous, rows);
        const plan = planDay(activeTasks(rows), DEFAULT_SETTINGS, { mode, minStart: changes.minStart, fixedBlocks: kept, ...changes.limits });
        plans.push(plan);
        const was = diffStarts(previous, plan);
        const lines = changeLines(previous, plan, new Map(rows.map((r) => [r.id, r.title])), was, changes.limits, added.map((a) => a.id), []);
        await route.fulfill({ json: { ...view(), changes: { at: toHHMM(changes.minStart), was, lines: lines.length ? lines : ["Rebuilt the rest of your day"] } } });
      });
      await page.route("**/api/day/undo", async (route) => {
        const body = route.request().postDataJSON() as { version: number; tasks: DayRow[] };
        const listed = new Set(body.tasks.map((t) => t.id));
        rows = [...body.tasks, ...rows.filter((r) => !listed.has(r.id)).map((r): DayRow => ({ ...r, status: "deleted" }))];
        plans.push(plans[body.version - 1]);
        await route.fulfill({ json: view() });
      });
      await use();
    },
    { auto: true },
  ],
  user: [
    async ({ context, baseURL, page }, use) => {
      const user = await createUser({ onboarded: true });
      await signInAs(context, user, baseURL ?? "http://localhost:3100");
      await use(user);
      await page.goto("about:blank").catch(() => {}); // stop in-flight requests before the account is deleted
      await deleteCreatedUsers();
    },
    { auto: true },
  ],
});
export { expect };
