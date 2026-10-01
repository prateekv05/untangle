import { ZodError } from "zod";
import { errorResponse, readJson } from "@/lib/api";
import { UuidParam, TaskPatchBody } from "@/lib/api-schemas";
import { requireUser } from "@/lib/session";
import { moveTaskToLater, updateTask } from "@/db/queries";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = UuidParam.safeParse((await params).id);
    if (!id.success) throw new ZodError(id.error.issues);
    const { moveTo, ...patch } = TaskPatchBody.parse(await readJson(request));
    const task = moveTo ? await moveTaskToLater(user.id, id.data, moveTo) : await updateTask(user.id, id.data, patch);
    return Response.json(task);
  } catch (e) {
    return errorResponse(e);
  }
}
