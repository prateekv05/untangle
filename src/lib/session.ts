/**
 * requireUser() is the only way a route learns who is calling. It reads the Auth.js session and nothing else.
 * Tests inject a session at this boundary through createRequireUser.
 */
import { getUserById } from "../db/queries";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  gender: string | null;
  onboarded: boolean;
  hasPassword: boolean;
};

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

type UserRow = NonNullable<Awaited<ReturnType<typeof getUserById>>>;

export function toSessionUser(row: UserRow): SessionUser {
  // The password hash never leaves this function.
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    gender: row.gender,
    onboarded: row.onboardedAt !== null,
    hasPassword: row.passwordHash !== null,
  };
}

export type RequireUserDeps = {
  getSessionUserId: () => Promise<string | null>;
  getUser: (id: string) => Promise<UserRow | null>;
};

export function createRequireUser({ getSessionUserId, getUser }: RequireUserDeps) {
  return async function requireUser(): Promise<SessionUser> {
    const id = await getSessionUserId();
    if (!id) throw new UnauthorizedError();
    const row = await getUser(id); // also catches a deleted account whose cookie is still valid
    if (!row) throw new UnauthorizedError();
    return toSessionUser(row);
  };
}

export const unauthorizedResponse = () => Response.json({ error: "unauthorized" }, { status: 401 });

export const requireUser = createRequireUser({
  getSessionUserId: async () => {
    const { auth } = await import("./auth"); // lazy so unit tests of this file need no Auth.js or env
    return (await auth())?.user?.id ?? null;
  },
  getUser: (id) => getUserById(id),
});
