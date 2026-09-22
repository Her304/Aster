import { NextRequest, NextResponse } from "next/server";
import {
  adminConfigured,
  adminNotConfigured,
  adminSessionCookie,
  adminTokenValid,
  clearAdminSessionCookie,
} from "@/lib/admin";
import { clientKey, isRateLimited } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  if (!adminConfigured()) return adminNotConfigured();
  return NextResponse.json({ ok: false });
}

export async function POST(request: NextRequest) {
  if (!adminConfigured()) return adminNotConfigured();
  if (isRateLimited(`admin-login:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`, 10)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const candidate = typeof body.token === "string" ? body.token.trim() : "";
  if (!adminTokenValid(candidate)) {
    return NextResponse.json({ ok: false, error: "Invalid admin token." }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminSessionCookie(candidate));
  return response;
}

export async function DELETE() {
  if (!adminConfigured()) return adminNotConfigured();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearAdminSessionCookie());
  return response;
}
