import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { execute, hashToken, queryOne, token, transaction } from "@/lib/db";

export const ACCOUNT_COOKIE = "aster_account";
export const VISITOR_COOKIE = "aster_visitor";

const DAY = 24 * 60 * 60 * 1000;
const SESSION_LIFETIME = 60 * DAY;
const VISITOR_LIFETIME = 365 * DAY;
const CODE_LIFETIME = 10 * 60 * 1000;
const CODE_ATTEMPTS = 5;
const CODES_PER_HOUR = 5;

export interface UserRow {
  id: string;
  email: string;
}

export interface VisitorRow {
  id: string;
  user_id: string | null;
}

export function normalizeEmail(input: unknown) {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function persistentCookie(name: string, value: string, lifetimeMs: number) {
  return {
    name,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(lifetimeMs / 1000),
  };
}

export const accountCookie = (value: string) => persistentCookie(ACCOUNT_COOKIE, value, SESSION_LIFETIME);
export const visitorCookie = (value: string) => persistentCookie(VISITOR_COOKIE, value, VISITOR_LIFETIME);
export const clearedCookie = (name: string) => ({ ...persistentCookie(name, "", 0), maxAge: 0 });

export async function currentUser(): Promise<UserRow | undefined> {
  const sessionToken = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  if (!sessionToken) return undefined;
  return queryOne<UserRow>(
    `SELECT u.id, u.email FROM user_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [hashToken(sessionToken), Date.now()],
  );
}

export async function currentVisitor(): Promise<VisitorRow | undefined> {
  const visitorToken = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!visitorToken) return undefined;
  return queryOne<VisitorRow>("SELECT id, user_id FROM visitors WHERE token_hash = ?", [hashToken(visitorToken)]);
}

/** Creates the per-browser identity that remembers which surveys this browser has answered. */
export async function createVisitor(userId: string | null) {
  const visitorToken = token();
  const id = randomUUID();
  await execute("INSERT INTO visitors (id, token_hash, user_id) VALUES (?, ?, ?)", [id, hashToken(visitorToken), userId]);
  return { id, token: visitorToken };
}

function codeHash(email: string, code: string) {
  return hashToken(`${email}:${code}`);
}

export async function issueSignInCode(email: string): Promise<{ code: string } | { limited: true }> {
  return transaction(async (database) => {
    const now = Date.now();
    const row = await database.get<{ sent_count: number | string; window_started_at: number | string }>(
      "SELECT sent_count, window_started_at FROM sign_in_codes WHERE email = ?",
      [email],
    );
    const inWindow = row && now - Number(row.window_started_at) < 60 * 60 * 1000;
    const sentCount = inWindow ? Number(row.sent_count) : 0;
    if (sentCount >= CODES_PER_HOUR) return { limited: true as const };

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await database.run(
      `INSERT INTO sign_in_codes (email, code_hash, expires_at, attempts, sent_count, window_started_at)
       VALUES (?, ?, ?, 0, ?, ?)
       ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at,
         attempts = 0, sent_count = excluded.sent_count, window_started_at = excluded.window_started_at`,
      [email, codeHash(email, code), now + CODE_LIFETIME, sentCount + 1, inWindow ? Number(row.window_started_at) : now],
    );
    return { code };
  });
}

export type CodeCheck = "ok" | "invalid" | "expired" | "locked";

export async function consumeSignInCode(email: string, code: string): Promise<CodeCheck> {
  if (!/^\d{6}$/.test(code)) return "invalid";
  return transaction(async (database) => {
    const row = await database.get<{ code_hash: string; expires_at: number | string; attempts: number | string }>(
      "SELECT code_hash, expires_at, attempts FROM sign_in_codes WHERE email = ?",
      [email],
    );
    if (!row || Number(row.expires_at) <= Date.now()) return "expired";
    if (Number(row.attempts) >= CODE_ATTEMPTS) return "locked";
    const expected = Buffer.from(row.code_hash, "hex");
    const supplied = Buffer.from(codeHash(email, code), "hex");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      await database.run("UPDATE sign_in_codes SET attempts = attempts + 1 WHERE email = ?", [email]);
      return Number(row.attempts) + 1 >= CODE_ATTEMPTS ? "locked" : "invalid";
    }
    // Spent: the row stays only so the hourly sending limit keeps counting.
    await database.run("UPDATE sign_in_codes SET expires_at = 0 WHERE email = ?", [email]);
    return "ok";
  });
}

/**
 * Finds or creates the account, opens a session, and attaches this browser's
 * earlier answers to it so they follow the person to other devices.
 */
export async function signIn(email: string, visitor: VisitorRow | undefined) {
  return transaction(async (database) => {
    let user = await database.get<UserRow>("SELECT id, email FROM users WHERE email = ?", [email]);
    if (!user) {
      user = { id: randomUUID(), email };
      await database.run("INSERT INTO users (id, email) VALUES (?, ?)", [user.id, email]);
    }
    const sessionToken = token();
    await database.run("INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
      hashToken(sessionToken),
      user.id,
      Date.now() + SESSION_LIFETIME,
    ]);
    await database.run("DELETE FROM user_sessions WHERE user_id = ? AND expires_at <= ?", [user.id, Date.now()]);
    if (visitor && (!visitor.user_id || visitor.user_id === user.id)) {
      await database.run("UPDATE visitors SET user_id = ? WHERE id = ?", [user.id, visitor.id]);
      await database.run(
        `UPDATE survey_responses SET user_id = ?
         WHERE visitor_id = ? AND user_id IS NULL AND is_owner = 0
           AND survey_id NOT IN (SELECT survey_id FROM survey_responses WHERE user_id = ?)
           AND survey_id NOT IN (SELECT id FROM surveys WHERE owner_id = ?)`,
        [user.id, visitor.id, user.id, user.id],
      );
    }
    return { user, sessionToken };
  });
}

export async function signOut(sessionToken: string | undefined) {
  if (sessionToken) await execute("DELETE FROM user_sessions WHERE token_hash = ?", [hashToken(sessionToken)]);
}
