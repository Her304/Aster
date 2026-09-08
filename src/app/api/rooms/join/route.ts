import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRoomByCode, hashToken, locking, token, transaction } from "@/lib/db";
import { cleanNickname, clientKey, error, isRateLimited } from "@/lib/http";
import { sessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (isRateLimited(`join:${clientKey(request)}`, 30)) return error("Too many join attempts. Please wait a minute.", 429);
  const body = await request.json().catch(() => ({}));
  const nickname = cleanNickname(body.nickname);
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!nickname) return error("Choose a nickname between 2 and 24 characters.");
  if (!/^[A-Z2-9]{6}$/.test(code)) return error("Enter a valid six-character room code.");

  const room = await getRoomByCode(code);
  if (!room) return error("We couldn’t find that room.", 404);
  const sessionToken = token();
  const recoveryToken = token();
  let issue: NextResponse | undefined;
  try {
    await transaction(async (database) => {
      const lockedRoom = await database.get<{ status: string }>(
        locking("SELECT status FROM rooms WHERE id = ?", database),
        [room.id],
      );
      if (!lockedRoom) {
        issue = error("We couldn’t find that room.", 404);
        return;
      }
      if (lockedRoom.status !== "lobby") {
        issue = error("This circle has already started.", 409);
        return;
      }
      const size = await database.get<{ count: number | string }>(
        "SELECT COUNT(*) AS count FROM participants WHERE room_id = ?",
        [room.id],
      );
      if (Number(size?.count || 0) >= 8) {
        issue = error("This room is full.", 409);
        return;
      }
      await database.run(
        "INSERT INTO participants (id, room_id, nickname, session_hash, recovery_hash) VALUES (?, ?, ?, ?, ?)",
        [randomUUID(), room.id, nickname, hashToken(sessionToken), hashToken(recoveryToken)],
      );
    });
  } catch {
    return error("That nickname is already in this room. Try a small variation.", 409);
  }
  if (issue) return issue;

  const response = NextResponse.json({
    code,
    recoveryPath: `/api/recover?token=${recoveryToken}`,
  });
  response.cookies.set(sessionCookie(sessionToken));
  return response;
}
