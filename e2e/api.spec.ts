import { expect, test, type APIRequestContext } from "@playwright/test";
import { createUser, deleteCreatedUsers, sessionCookieValue, type TestUser } from "./support";
import { createDayWithTasks } from "../src/db/queries";
import { makeDb } from "../src/db/client";

const UUID = "00000000-0000-4000-8000-000000000000";
const SETTINGS = { workStart: "09:00", workEnd: "17:00", workDays: [1, 2, 3, 4, 5], wake: "07:00", sleep: "23:00", timezone: "Europe/London" };
const PRESET = { verb: "Swim", location: "outside", kind: "health", defaultDurationMin: 45 };

type Route = { method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE"; path: string; body?: unknown };
const ROUTES: Route[] = [
  { method: "GET", path: "/api/me" },
  { method: "PUT", path: "/api/me", body: { name: "Sam" } },
  { method: "PUT", path: "/api/me/password", body: { password: "long enough password" } },
  { method: "DELETE", path: "/api/me/password" },
  { method: "GET", path: "/api/settings" },
  { method: "PUT", path: "/api/settings", body: SETTINGS },
  { method: "GET", path: "/api/presets" },
  { method: "POST", path: "/api/presets", body: PRESET },
  { method: "DELETE", path: `/api/presets/${UUID}` },
  { method: "GET", path: "/api/day?date=2026-10-01" },
  { method: "PATCH", path: `/api/tasks/${UUID}`, body: { title: "x" } },
  { method: "POST", path: "/api/understand", body: { text: "gym" } },
];

const as = async (u: TestUser) => ({ headers: { cookie: `authjs.session-token=${await sessionCookieValue(u)}` } });
const send = (request: APIRequestContext, r: Route, headers?: Record<string, string>) =>
  request.fetch(r.path, { method: r.method, headers, data: r.body });

test.afterAll(deleteCreatedUsers);

test.describe("without a session", () => {
  for (const r of ROUTES) {
    test(`${r.method} ${r.path.split("?")[0].replace(UUID, ":id")} is 401`, async ({ request }) => {
      const res = await send(request, r);
      expect(res.status()).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    });
  }
});

test.describe("malformed input is 400, never 500", () => {
  const BAD: Route[] = [
    { method: "PUT", path: "/api/me", body: { name: "" } },
    { method: "PUT", path: "/api/me", body: { nickname: "x" } },
    { method: "PUT", path: "/api/me/password", body: { password: "short" } },
    { method: "PUT", path: "/api/settings", body: { ...SETTINGS, workStart: "9am" } },
    { method: "PUT", path: "/api/settings", body: { ...SETTINGS, timezone: "Mars/Olympus" } },
    { method: "PUT", path: "/api/settings", body: { ...SETTINGS, workDays: [7] } },
    { method: "PUT", path: "/api/settings", body: {} },
    { method: "POST", path: "/api/presets", body: { ...PRESET, kind: "fixed" } },
    { method: "POST", path: "/api/presets", body: { ...PRESET, verb: "   " } },
    { method: "POST", path: "/api/presets", body: { ...PRESET, defaultDurationMin: 1 } },
    { method: "DELETE", path: "/api/presets/not-a-uuid" },
    { method: "GET", path: "/api/day" },
    { method: "GET", path: "/api/day?date=tomorrow" },
    { method: "GET", path: "/api/day?date=2026-02-30" },
    { method: "POST", path: "/api/understand", body: { text: "   " } },
    { method: "POST", path: "/api/understand", body: { text: "x".repeat(4001) } },
    { method: "POST", path: "/api/understand", body: { text: "gym", extra: 1 } },
    { method: "PATCH", path: "/api/tasks/not-a-uuid", body: { title: "x" } },
    { method: "PATCH", path: `/api/tasks/${UUID}`, body: {} },
    { method: "PATCH", path: `/api/tasks/${UUID}`, body: { durationMin: -5 } },
    { method: "PATCH", path: `/api/tasks/${UUID}`, body: { status: "deleted" } },
    { method: "PATCH", path: `/api/tasks/${UUID}`, body: { moveTo: "2026-10-02", title: "x" } },
  ];
  for (const r of BAD) {
    test(`${r.method} ${r.path} ${JSON.stringify(r.body ?? "").slice(0, 80)}`, async ({ request }) => {
      const user = await createUser({ onboarded: true });
      const res = await send(request, r, (await as(user)).headers);
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe("invalid_input");
    });
  }

  test("a body that is not JSON is 400", async ({ request }) => {
    const user = await createUser({ onboarded: true });
    const res = await request.put("/api/settings", { headers: { ...(await as(user)).headers, "content-type": "application/json" }, data: "{nope" });
    expect(res.status()).toBe(400);
  });
});

test("settings and presets round-trip for the owner and stay private", async ({ request }) => {
  const [a, b] = [await createUser({ onboarded: true }), await createUser({ onboarded: true })];
  const ha = (await as(a)).headers;
  const hb = (await as(b)).headers;

  expect((await (await request.get("/api/settings", { headers: ha })).json()).timezone).toBe("UTC");
  const put = await request.put("/api/settings", { headers: ha, data: { ...SETTINGS, workDays: [5, 1, 1, 3] } });
  expect((await put.json()).workDays).toEqual([1, 3, 5]); // sorted, deduped
  expect((await (await request.get("/api/settings", { headers: hb })).json()).timezone).toBe("UTC");

  const made = await request.post("/api/presets", { headers: ha, data: PRESET });
  expect(made.status()).toBe(201);
  const preset = await made.json();
  await request.post("/api/presets", { headers: ha, data: { ...PRESET, verb: "swim", defaultDurationMin: null } }); // same phrase, other case
  const list = await (await request.get("/api/presets", { headers: ha })).json();
  expect(list).toHaveLength(1);
  expect(list[0].defaultDurationMin).toBeNull();
  expect(await (await request.get("/api/presets", { headers: hb })).json()).toEqual([]);

  expect((await request.delete(`/api/presets/${preset.id}`, { headers: hb })).status()).toBe(404); // b cannot delete a's
  expect((await request.delete(`/api/presets/${list[0].id}`, { headers: ha })).status()).toBe(204);
  expect(await (await request.get("/api/presets", { headers: ha })).json()).toEqual([]);
});

test("day and task routes only reach the owner's data", async ({ request }) => {
  const [a, b] = [await createUser({ onboarded: true }), await createUser({ onboarded: true })];
  const ha = (await as(a)).headers;
  const hb = (await as(b)).headers;
  const { tasks } = await createDayWithTasks(a.id, "2026-10-01", "workday", "gym", [
    { title: "Gym", location: "outside", kind: "health", durationMin: 60, durationSource: "user", fixedStart: null, due: "today" },
  ], makeDb(process.env.TEST_DATABASE_URL!));
  const id = tasks[0].id;

  const day = await (await request.get("/api/day?date=2026-10-01", { headers: ha })).json();
  expect(day.day.tasks).toHaveLength(1);
  expect((await (await request.get("/api/day?date=2026-10-01", { headers: hb })).json()).day).toBeNull();

  expect((await request.patch(`/api/tasks/${id}`, { headers: hb, data: { title: "Hijacked" } })).status()).toBe(404);
  const ok = await request.patch(`/api/tasks/${id}`, { headers: ha, data: { durationMin: 90, durationSource: "user" } });
  expect((await ok.json()).durationMin).toBe(90);
  expect((await request.patch(`/api/tasks/${id}`, { headers: ha, data: { moveTo: "2026-10-01" } })).status()).toBe(400); // not later
  expect((await request.patch(`/api/tasks/${id}`, { headers: ha, data: { moveTo: "2026-10-02" } })).status()).toBe(200);
  expect((await (await request.get("/api/day?date=2026-10-02", { headers: ha })).json()).carried).toHaveLength(1);
});
