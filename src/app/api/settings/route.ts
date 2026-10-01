import { errorResponse, readJson } from "@/lib/api";
import { SettingsInput } from "@/lib/api-schemas";
import { requireUser } from "@/lib/session";
import { getSettings } from "@/db/queries";
import { saveSettings } from "@/db/queries/presets";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(await getSettings(user.id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const input = SettingsInput.parse(await readJson(request));
    return Response.json(await saveSettings(user.id, input));
  } catch (e) {
    return errorResponse(e);
  }
}
