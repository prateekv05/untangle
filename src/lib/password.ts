/** Password hashing with scrypt from node:crypto. Stored as "salt:hash", both hex. No extra dependency. */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const MIN_PASSWORD_LENGTH = 10;
const KEY_LEN = 64;
const SALT_LEN = 16;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await derive(password, salt);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

/** Constant-time compare. A malformed stored value never matches. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex, ...rest] = stored.split(":");
  if (!saltHex || !keyHex || rest.length > 0 || !/^[0-9a-f]+$/i.test(saltHex + keyHex)) return false;
  const expected = Buffer.from(keyHex, "hex");
  if (expected.length !== KEY_LEN) return false;
  const actual = await derive(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}

let dummy: Promise<string> | undefined;

/** A real hash to verify against when the email is unknown, so the response time does not reveal it. */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword("not-a-real-password");
  return dummy;
}
