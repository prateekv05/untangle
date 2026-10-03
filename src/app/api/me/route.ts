import { deleteAccount } from "@/db/queries/account";
import { DeleteAccount, MeUpdate } from "@/lib/account-schemas";
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

/** Deletes the account and all of its data. The optional reason is stored in account_feedback with no user id. */
export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const { reason } = DeleteAccount.parse(await readJson(request).catch(() => ({})));
    await deleteAccount(user.id, reason || undefined);
    return Response.json({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
