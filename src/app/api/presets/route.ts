import { errorResponse, readJson } from "@/lib/api";
import { PresetBody } from "@/lib/api-schemas";
import { requireUser } from "@/lib/session";
import { listPresets, savePreset } from "@/db/queries/presets";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(await listPresets(user.id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = PresetBody.parse(await readJson(request));
    return Response.json(await savePreset(user.id, input), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
