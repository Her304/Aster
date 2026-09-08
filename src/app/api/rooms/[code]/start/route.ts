import { NextResponse } from "next/server";
import { createAssessments, db, getRoomByCode } from "@/lib/db";
import { error } from "@/lib/http";
import { currentParticipant } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = getRoomByCode(code);
  if (!room) return error("Room not found.", 404);
  const participant = await currentParticipant(room.id);
  if (!participant) return error("You’re not a member of this room.", 401);
  if (participant.id !== room.host_participant_id) return error("Only the host can start the circle.", 403);
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
    if (size.count < 2) {
      db.exec("ROLLBACK");
      transactionOpen = false;
      return error("Invite at least one friend before starting.", 409);
    }
    createAssessments(room.id, false);
    db.exec("COMMIT");
    transactionOpen = false;
  } catch {
    if (transactionOpen) db.exec("ROLLBACK");
    return error("The circle couldn’t be locked. Please try again.", 500);
  }
  return NextResponse.json({ ok: true });
}
