import { MeUpdate } from "@/lib/account-schemas";
import { errorResponse, readJson } from "@/lib/api";
import { applyMeUpdate } from "@/lib/me";
import { requireUser } from "@/lib/session";

export async function GET() {
  try {
    return Response.json(await requireUser());
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const input = MeUpdate.parse(await readJson(request));
    return Response.json(await applyMeUpdate(user.id, input));
  } catch (e) {
    return errorResponse(e);
  }
}
