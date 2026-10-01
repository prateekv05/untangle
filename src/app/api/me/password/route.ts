import { PasswordUpdate } from "@/lib/account-schemas";
import { errorResponse, readJson } from "@/lib/api";
import { clearPassword, setPassword } from "@/db/queries/account";
import { hashPassword } from "@/lib/password";
import { requireUser } from "@/lib/session";

/** Set or change the password. Signed in only; the hash is never returned. */
export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const { password } = PasswordUpdate.parse(await readJson(request));
    await setPassword(user.id, await hashPassword(password));
    return Response.json({ hasPassword: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Back to Google-only. */
export async function DELETE() {
  try {
    const user = await requireUser();
    await clearPassword(user.id);
    return Response.json({ hasPassword: false });
  } catch (e) {
    return errorResponse(e);
  }
}
