import { ZodError } from "zod";
import { errorResponse } from "@/lib/api";
import { UuidParam } from "@/lib/api-schemas";
import { requireUser } from "@/lib/session";
import { NotFoundError } from "@/db/queries";
import { getHistoryDay } from "@/db/queries/history";

/** GET /api/history/:dayId: one past day, read-only: its tasks and its latest plan. */
export async function GET(_request: Request, { params }: { params: Promise<{ dayId: string }> }) {
  try {
    const user = await requireUser();
    const parsed = UuidParam.safeParse((await params).dayId);
    if (!parsed.success) throw new ZodError(parsed.error.issues);
    const day = await getHistoryDay(user.id, parsed.data);
    if (!day) throw new NotFoundError("Day");
    return Response.json({ date: day.day.date, mode: day.day.mode, tasks: day.tasks, plan: day.plan!.snapshot, plannedAt: day.plan!.createdAt });
  } catch (e) {
    return errorResponse(e);
  }
}
