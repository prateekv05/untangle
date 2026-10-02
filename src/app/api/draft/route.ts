import { errorResponse, readJson } from "@/lib/api";
import { DraftPayload } from "@/lib/draft";
import { requireUser } from "@/lib/session";
import { deleteDraft, getDraft, saveDraft } from "@/db/queries/draft";

/** GET /api/draft: the unfinished list, or { draft: null }. */
export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ draft: await getDraft(user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PUT /api/draft: replace the unfinished list. Called as the user types, so it does no AI work and counts against nothing. */
export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    await saveDraft(user.id, DraftPayload.parse(await readJson(request)));
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await deleteDraft(user.id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
