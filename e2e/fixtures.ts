import { test as base, expect } from "@playwright/test";
import { fixtureTasksFor } from "../src/fixtures/example";
import { planDay } from "../src/lib/planner";
import { activeTasks, keptBlocksFor, resolveMoveTarget, type DayRow } from "../src/lib/day-edit";
import { DEFAULT_SETTINGS, type Plan, type Task } from "../src/lib/schemas";
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
