import { expect, test } from "./fixtures";
import { sessionCookieValue } from "./support";

const DUMP = "Need to finish SQL assignment due tomorrow, grocery shopping, call mom, gym for 90 minutes, buy toothpaste";

// Real model, real database. Costs a few cents: opt in with RUN_AI_E2E=1.
test.describe("real model", () => {
  test.skip(!process.env.RUN_AI_E2E, "set RUN_AI_E2E=1 to call the model");

  test("plans the saved day, keeps new tasks, saves version 1 with its model", async ({ request, user }) => {
    const headers = { cookie: `authjs.session-token=${await sessionCookieValue(user)}` };
    const understood = await (await request.post("/api/understand", { headers, data: { text: DUMP } })).json();
    const extra = { title: "Water the plants", location: "home", kind: "chore", durationMin: 10, durationSource: "user", fixedStart: null, due: null };
    const tasks = [...understood.tasks.slice(1), extra]; // one task removed, one added on the Understand screen
    const res = await request.post("/api/plan", { headers, data: { dayId: understood.dayId, mode: "dayoff", tasks } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.tasks.map((t: { title: string }) => t.title)).toContain("Water the plants");
    expect(body.tasks).toHaveLength(tasks.length);
    const planned = new Set<string>([...body.plan.blocks.map((b: { taskId: string }) => b.taskId), ...body.plan.dropped.map((d: { taskId: string }) => d.taskId)]);
    expect([...planned].sort()).toEqual(body.tasks.map((t: { id: string }) => t.id).sort());
    for (const b of body.plan.blocks) expect(b.reason.length).toBeGreaterThan(0);

    const saved = await (await request.get(`/api/day?date=${understood.date}`, { headers })).json();
    expect(saved.day.plan.version).toBe(1);
    expect(saved.day.plan.source).toBe(body.source);
    expect(saved.day.plan.model).toBe(body.model);
  });
});
