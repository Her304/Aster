import { NextResponse } from "next/server";
import { createAssessments, getRoomByCode, locking, transaction } from "@/lib/db";
import { error } from "@/lib/http";
import { currentParticipant } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await getRoomByCode(code);
  if (!room) return error("Room not found.", 404);
  const participant = await currentParticipant(room.id);
  if (!participant) return error("You’re not a member of this room.", 401);
  if (participant.id !== room.host_participant_id) return error("Only the host can start the circle.", 403);
  let issue: NextResponse | undefined;
  try {
    await transaction(async (database) => {
      const lockedRoom = await database.get<{ status: string }>(
        locking("SELECT status FROM rooms WHERE id = ?", database),
        [room.id],
      );
      if (!lockedRoom || lockedRoom.status !== "lobby") {
        issue = error("This circle has already started.", 409);
        return;
      }
      const size = await database.get<{ count: number | string }>(
        "SELECT COUNT(*) AS count FROM participants WHERE room_id = ?",
        [room.id],
      );
      if (Number(size?.count || 0) < 2) {
        issue = error("Invite at least one friend before starting.", 409);
        return;
      }
      await createAssessments(room.id, database);
    });
  } catch {
    return error("The circle couldn’t be locked. Please try again.", 500);
  }
  if (issue) return issue;
  return NextResponse.json({ ok: true });
}
