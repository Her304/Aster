import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/db";
import { cleanNickname, clientKey, error, isRateLimited } from "@/lib/http";
import { sessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (isRateLimited(`create:${clientKey(request)}`, 10)) return error("Too many new rooms. Please wait a minute.", 429);
  const body = await request.json().catch(() => ({}));
  const nickname = cleanNickname(body.nickname);
  if (!nickname) return error("Choose a nickname between 2 and 24 characters.");

  const created = createRoom(nickname);
  const response = NextResponse.json({
    code: created.code,
    recoveryPath: `/api/recover?token=${created.recoveryToken}`,
  });
  response.cookies.set(sessionCookie(created.sessionToken));
  return response;
}
