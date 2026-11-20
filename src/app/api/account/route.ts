import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, VISITOR_COOKIE, clearedCookie, currentUser } from "@/lib/accounts";
import { execute } from "@/lib/db";
import { error, isCrossSite } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Deletes the account with its survey, every answer to it, its sessions, and
 * every answer this account gave to other people's surveys.
 */
export async function DELETE(request: Request) {
  if (isCrossSite(request)) return error("Cross-site request refused.", 403);
  const user = await currentUser();
  if (!user) return error("Sign in first.", 401);
  await execute("DELETE FROM users WHERE id = ?", [user.id]);
  await execute("DELETE FROM sign_in_codes WHERE email = ?", [user.email]);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearedCookie(ACCOUNT_COOKIE));
  response.cookies.set(clearedCookie(VISITOR_COOKIE));
  return response;
}
