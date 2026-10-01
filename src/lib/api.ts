/** One place that turns thrown errors into typed JSON responses. Never leaks a stack trace or a message from the server. */
import { ZodError } from "zod";
import { InputError, NotFoundError } from "../db/queries/helpers";
import { PresetLimitError } from "../db/queries/presets";
import { UnauthorizedError } from "./session";

export function errorResponse(e: unknown): Response {
  if (e instanceof UnauthorizedError) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (e instanceof ZodError) {
    return Response.json({ error: "invalid_input", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  }
  if (e instanceof InputError) return Response.json({ error: "invalid_input", issues: [{ path: "", message: e.message }] }, { status: 400 });
  if (e instanceof PresetLimitError) return Response.json({ error: "limit_reached" }, { status: 409 });
  if (e instanceof NotFoundError) return Response.json({ error: "not_found" }, { status: 404 });
  console.error("api error:", e instanceof Error ? e.name : "unknown"); // name only: messages can carry user data
  return Response.json({ error: "server_error" }, { status: 500 });
}

/** Parses a JSON body; a missing or malformed body becomes a 400 through ZodError. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ZodError([{ code: "custom", path: [], message: "Body must be JSON", input: undefined }]);
  }
}
