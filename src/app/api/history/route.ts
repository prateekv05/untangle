import { errorResponse } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { listHistory } from "@/db/queries/history";

/** GET /api/history: the user's planned days, newest first, with how many tasks were done. */
export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ days: await listHistory(user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
