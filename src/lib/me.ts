import type { Db } from "../db/client";
import { getDb } from "../db/client";
import { getUserById } from "../db/queries";
import { completeOnboarding, updateAccount } from "../db/queries/account";
import { GENDERS, NotFoundError, type Gender } from "../db/queries/helpers";
import { ZodError } from "zod";
import type { MeUpdate } from "./account-schemas";
import { toSessionUser, type SessionUser } from "./session";

const isGender = (v: string | null): v is Gender => v !== null && (GENDERS as readonly string[]).includes(v);

export async function applyMeUpdate(userId: string, input: MeUpdate, db: Db = getDb()): Promise<SessionUser> {
  const { complete, ...patch } = input;
  let row = await updateAccount(userId, patch, db);
  if (complete) {
    if (!row.name) throw new ZodError([{ code: "custom", path: ["name"], message: "A name is needed to finish", input: undefined }]);
    row = await completeOnboarding(userId, { name: row.name, gender: isGender(row.gender) ? row.gender : null }, db);
  }
  return toSessionUser(row);
}

export async function getMe(userId: string, db: Db = getDb()): Promise<SessionUser> {
  const row = await getUserById(userId, db);
  if (!row) throw new NotFoundError("User");
  return toSessionUser(row);
}
