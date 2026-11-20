import { NextResponse } from "next/server";
import { issueSignInCode, normalizeEmail } from "@/lib/accounts";
import { clientKey, error, isCrossSite, isRateLimited } from "@/lib/http";
import { emailConfigured, mailLocale, sendSignInCode } from "@/lib/mailer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isCrossSite(request)) return error("Cross-site request refused.", 403);
  if (isRateLimited(`code:${clientKey(request)}`, 5)) return error("Too many codes requested. Please wait a minute.", 429);
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) return error("Enter a valid email address.");
  if (!emailConfigured() && process.env.NODE_ENV === "production") {
    return error("Email sign-in isn’t set up on this server yet.", 503);
  }
  const issued = await issueSignInCode(email);
  if ("limited" in issued) return error("Too many codes for this address. Try again in an hour.", 429);
  try {
    await sendSignInCode(email, issued.code, mailLocale(body.locale), new URL(request.url).origin);
  } catch {
    return error("The code couldn’t be sent. Please try again.", 502);
  }
  return NextResponse.json({ ok: true });
}
