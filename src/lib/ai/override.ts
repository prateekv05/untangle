/** Server-only: the model override for this request's device, read from its httpOnly cookie. */
import { cookies } from "next/headers";
import { OVERRIDE_COOKIE, parseOverride, type ModelOverride } from "./models";

export async function readModelOverride(): Promise<ModelOverride> {
  return parseOverride((await cookies()).get(OVERRIDE_COOKIE)?.value);
}
