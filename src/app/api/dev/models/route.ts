import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api";
import { OVERRIDE_COOKIE, ROLES, serializeOverride, type ModelOverride } from "@/lib/ai/models";
import { getEnv } from "@/lib/env";
import { requireUser } from "@/lib/session";

const Body = z.object({ key: z.string().max(200), plan: z.string().max(100).nullable().optional(), fast: z.string().max(100).nullable().optional() }).strict();

const sameKey = (given: string, expected: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** POST /api/dev/models: choose a model per role for this device only. 404 when MODEL_SWITCH_KEY is empty. */
export async function POST(request: Request) {
  try {
    await requireUser();
    const env = getEnv();
    if (!env.MODEL_SWITCH_KEY) return Response.json({ error: "not_found" }, { status: 404 });
    const body = Body.parse(await readJson(request));
    if (!sameKey(body.key, env.MODEL_SWITCH_KEY)) return Response.json({ error: "forbidden" }, { status: 403 });
    const override: ModelOverride = {};
    for (const role of ROLES) {
      const spec = body[role];
      if (!spec) continue; // null or missing = use the default for that role
      if (!env.AI_MODEL_ALLOWLIST.includes(spec)) return Response.json({ error: "invalid_input", issues: [{ path: role, message: "Not on the allowlist" }] }, { status: 400 });
      override[role] = spec;
    }
    const jar = await cookies();
    if (Object.keys(override).length === 0) jar.delete(OVERRIDE_COOKIE);
    else jar.set(OVERRIDE_COOKIE, serializeOverride(override), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    return Response.json(override);
  } catch (e) {
    return errorResponse(e);
  }
}
