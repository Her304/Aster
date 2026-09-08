import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, getRoomByCode, hashToken, token } from "@/lib/db";
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

  const room = getRoomByCode(code);
  if (!room) return error("We couldn’t find that room.", 404);
  const sessionToken = token();
  const recoveryToken = token();
  let transactionOpen = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    const lockedRoom = db.prepare("SELECT status FROM rooms WHERE id = ?").get(room.id) as { status: string };
    if (lockedRoom.status !== "lobby") {
      db.exec("ROLLBACK");
      transactionOpen = false;
      return error("This circle has already started.", 409);
    }
    const size = db.prepare("SELECT COUNT(*) AS count FROM participants WHERE room_id = ?").get(room.id) as { count: number };
    if (size.count >= 8) {
      db.exec("ROLLBACK");
      transactionOpen = false;
      return error("This room is full.", 409);
    }
    db.prepare(
      "INSERT INTO participants (id, room_id, nickname, session_hash, recovery_hash) VALUES (?, ?, ?, ?, ?)",
    ).run(randomUUID(), room.id, nickname, hashToken(sessionToken), hashToken(recoveryToken));
    db.exec("COMMIT");
    transactionOpen = false;
  } catch {
    if (transactionOpen) db.exec("ROLLBACK");
    return error("That nickname is already in this room. Try a small variation.", 409);
  }

  const response = NextResponse.json({
    code,
    recoveryPath: `/api/recover?token=${recoveryToken}`,
  });
  response.cookies.set(sessionCookie(sessionToken));
  return response;
}
