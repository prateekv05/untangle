import { errorResponse } from "@/lib/api";
import { DayQuery } from "@/lib/api-schemas";
import { requireUser } from "@/lib/session";
import { carryOver, getDay } from "@/db/queries";

/** GET /api/day?date=YYYY-MM-DD: that day's tasks and latest plan, plus tasks carried over to it. */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { date } = DayQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
    const [day, carried] = await Promise.all([getDay(user.id, date), carryOver(user.id, date)]);
    return Response.json({ date, day, carried });
  } catch (e) {
    return errorResponse(e);
  }
}
