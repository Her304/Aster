import { NextResponse } from "next/server";
import {
  accountCookie,
  consumeSignInCode,
  createVisitor,
  currentVisitor,
  normalizeEmail,
  signIn,
  visitorCookie,
} from "@/lib/accounts";
import { clientKey, error, isCrossSite, isRateLimited } from "@/lib/http";

export const runtime = "nodejs";

const messages = {
  invalid: ["That code doesn’t match. Check the latest email.", 400],
  expired: ["That code has expired. Ask for a new one.", 410],
  locked: ["Too many wrong attempts. Ask for a new code.", 429],
} as const;

export async function POST(request: Request) {
  if (isCrossSite(request)) return error("Cross-site request refused.", 403);
  if (isRateLimited(`verify:${clientKey(request)}`, 20)) return error("Too many attempts. Please wait a minute.", 429);
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const code = typeof body.code === "string" ? body.code.replace(/\s/g, "") : "";
  if (!email) return error("Enter a valid email address.");

  const check = await consumeSignInCode(email, code);
  if (check !== "ok") return error(messages[check][0], messages[check][1]);

  const visitor = await currentVisitor();
  const { user, sessionToken } = await signIn(email, visitor);
  const response = NextResponse.json({ user: { email: user.email } });
  response.cookies.set(accountCookie(sessionToken));
  // A browser remembered for someone else starts afresh, so their answers don't show as this person's.
  if (visitor?.user_id && visitor.user_id !== user.id) {
    const fresh = await createVisitor(user.id);
    response.cookies.set(visitorCookie(fresh.token));
  }
  return response;
}
