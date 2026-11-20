import { NextResponse } from "next/server";
import { getAssessment, locking, maybeRevealRoom, transaction } from "@/lib/db";
import { error } from "@/lib/http";
import { currentParticipant } from "@/lib/session";
import { SURVEY_LENGTH, SURVEY_QUESTION_IDS } from "@/lib/survey";

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
      const fresh = await database.get<{ status: string; room_id: string }>(
        locking("SELECT status, room_id FROM assessments WHERE id = ?", database),
        [id],
      );
      if (!fresh) {
        issue = error("Assessment not found.", 404);
        return;
      }
      if (fresh.status === "submitted") return;
      const answered = await database.all<{ question_id: number }>(
        "SELECT question_id FROM answers WHERE assessment_id = ?",
        [id],
      );
      const count = answered.filter((answer) => SURVEY_QUESTION_IDS.has(Number(answer.question_id))).length;
      if (count !== SURVEY_LENGTH) {
        issue = error(`Answer all ${SURVEY_LENGTH} questions before submitting. “Not sure” is always okay.`, 409);
        return;
      }
      await database.run("UPDATE assessments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?", [
        id,
      ]);
      // Self-reflections count too: results open once everyone has answered about everyone.
      revealed = await maybeRevealRoom(fresh.room_id, database);
    });
  } catch {
    return error("The assessment couldn’t be submitted. Please try again.", 500);
  }
  if (issue) return issue;
  return NextResponse.json({ ok: true, revealed });
}
