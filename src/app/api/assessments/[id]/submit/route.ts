import { NextResponse } from "next/server";
import { getAssessment, locking, maybeRevealRoom, transaction } from "@/lib/db";
import { error } from "@/lib/http";
import { currentParticipant } from "@/lib/session";
import { SURVEY_LENGTH } from "@/lib/survey";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessment = await getAssessment(id);
  if (!assessment) return error("Assessment not found.", 404);
  const participant = await currentParticipant(assessment.room_id);
  if (!participant || participant.id !== assessment.reviewer_id) return error("This isn’t your assessment.", 403);
  let revealed = false;
  let issue: NextResponse | undefined;
  try {
    await transaction(async (database) => {
      await database.get(locking("SELECT id FROM rooms WHERE id = ?", database), [assessment.room_id]);
      const fresh = await database.get<{ status: string; is_self: number; room_id: string }>(
        locking("SELECT status, is_self, room_id FROM assessments WHERE id = ?", database),
        [id],
      );
      if (!fresh) {
        issue = error("Assessment not found.", 404);
        return;
      }
      if (fresh.status === "submitted") return;
      const count = await database.get<{ count: number | string }>(
        "SELECT COUNT(*) AS count FROM answers WHERE assessment_id = ?",
        [id],
      );
      if (Number(count?.count || 0) !== SURVEY_LENGTH) {
        issue = error(`Answer all ${SURVEY_LENGTH} questions before submitting. “Not sure” is always okay.`, 409);
        return;
      }
      await database.run("UPDATE assessments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?", [
        id,
      ]);
      revealed = fresh.is_self ? false : await maybeRevealRoom(fresh.room_id, database);
    });
  } catch {
    return error("The assessment couldn’t be submitted. Please try again.", 500);
  }
  if (issue) return issue;
  return NextResponse.json({ ok: true, revealed });
}
