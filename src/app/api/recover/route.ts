import { NextRequest, NextResponse } from "next/server";
import { execute, hashToken, queryOne, token } from "@/lib/db";
import { sessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const recovery = request.nextUrl.searchParams.get("token");
  if (!recovery) return NextResponse.redirect(new URL("/?recovery=invalid", request.url));

  const participant = await queryOne<{ id: string; code: string }>(
    "SELECT p.id, r.code FROM participants p JOIN rooms r ON r.id = p.room_id WHERE p.recovery_hash = ?",
    [hashToken(recovery)],
  );
  if (!participant) return NextResponse.redirect(new URL("/?recovery=invalid", request.url));

  const freshSession = token();
  await execute("UPDATE participants SET session_hash = ? WHERE id = ?", [hashToken(freshSession), participant.id]);
  const response = NextResponse.redirect(new URL(`/?room=${participant.code}`, request.url));
  response.cookies.set(sessionCookie(freshSession));
  return response;
}
