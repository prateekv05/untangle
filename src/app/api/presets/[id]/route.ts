import { ZodError } from "zod";
import { errorResponse } from "@/lib/api";
import { UuidParam } from "@/lib/api-schemas";
import { requireUser } from "@/lib/session";
import { deletePreset } from "@/db/queries/presets";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const parsed = UuidParam.safeParse((await params).id);
    if (!parsed.success) throw new ZodError(parsed.error.issues);
    await deletePreset(user.id, parsed.data);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
