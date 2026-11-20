import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCOUNT_COOKIE, VISITOR_COOKIE, clearedCookie, currentVisitor, signOut } from "@/lib/accounts";
import { error, isCrossSite } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isCrossSite(request)) return error("Cross-site request refused.", 403);
  const visitor = await currentVisitor();
  await signOut((await cookies()).get(ACCOUNT_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearedCookie(ACCOUNT_COOKIE));
  // This browser's memory belongs to the account now; the next person here starts clean.
  if (visitor?.user_id) response.cookies.set(clearedCookie(VISITOR_COOKIE));
  return response;
}
