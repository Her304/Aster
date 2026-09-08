import { NextResponse } from "next/server";
import { db, getAssessment, maybeRevealRoom } from "@/lib/db";
import { error } from "@/lib/http";
import { currentParticipant } from "@/lib/session";
import { SURVEY_LENGTH } from "@/lib/survey";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessment = getAssessment(id);
  if (!assessment) return error("Assessment not found.", 404);
  const participant = await currentParticipant(assessment.room_id);
  if (!participant || participant.id !== assessment.reviewer_id) return error("This isn’t your assessment.", 403);
  let revealed = false;
  let transactionOpen = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    const fresh = db.prepare("SELECT status, is_self, room_id FROM assessments WHERE id = ?").get(id) as
      | { status: string; is_self: number; room_id: string }
      | undefined;
    if (!fresh) {
      db.exec("ROLLBACK");
      transactionOpen = false;
      return error("Assessment not found.", 404);
    }
    if (fresh.status === "submitted") {
      db.exec("COMMIT");
      transactionOpen = false;
      return NextResponse.json({ ok: true });
    }
    const count = db.prepare("SELECT COUNT(*) AS count FROM answers WHERE assessment_id = ?").get(id) as {
      count: number;
    };
    if (count.count !== SURVEY_LENGTH) {
      db.exec("ROLLBACK");
      transactionOpen = false;
      return error(`Answer all ${SURVEY_LENGTH} questions before submitting. “Not sure” is always okay.`, 409);
    }
    db.prepare("UPDATE assessments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    revealed = fresh.is_self ? false : maybeRevealRoom(fresh.room_id);
    db.exec("COMMIT");
    transactionOpen = false;
  } catch {
    if (transactionOpen) db.exec("ROLLBACK");
    return error("The assessment couldn’t be submitted. Please try again.", 500);
  }
  return NextResponse.json({ ok: true, revealed });
}
