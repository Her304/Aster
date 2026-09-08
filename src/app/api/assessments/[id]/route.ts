import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAssessment, locking, queryAll, transaction } from "@/lib/db";
import { error } from "@/lib/http";
import { currentParticipant } from "@/lib/session";
import { SURVEY_QUESTIONS } from "@/lib/survey";

export const runtime = "nodejs";

async function authorize(id: string) {
  const assessment = await getAssessment(id);
  if (!assessment) return { response: error("Assessment not found.", 404) };
  const participant = await currentParticipant(assessment.room_id);
  if (!participant || participant.id !== assessment.reviewer_id) {
    return { response: error("You can only open your own assessments.", 403) };
  }
  return { assessment, participant };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await authorize(id);
  if (access.response) return access.response;
  const answers = await queryAll<{ question_id: number; value: number }>(
    "SELECT question_id, value FROM answers WHERE assessment_id = ?",
    [id],
  );
  return NextResponse.json({
    assessment: {
      id: access.assessment!.id,
      targetName: access.assessment!.target_name,
      isSelf: Boolean(access.assessment!.is_self),
      status: access.assessment!.status,
    },
    answers: Object.fromEntries(answers.map((answer) => [answer.question_id, answer.value])),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await authorize(id);
  if (access.response) return access.response;
  if (access.assessment!.status === "submitted") return error("Submitted assessments can’t be changed.", 409);

  const body = await request.json().catch(() => ({}));
  const questionId = Number(body.questionId);
  const value = Number(body.value);
  if (!SURVEY_QUESTIONS.some((question) => question.id === questionId)) return error("Unknown question.");
  if (!Number.isInteger(value) || value < 0 || value > 5) return error("Choose a valid response.");

  let submitted = false;
  try {
    await transaction(async (database) => {
      const fresh = await database.get<{ status: string }>(
        locking("SELECT status FROM assessments WHERE id = ?", database),
        [id],
      );
      if (!fresh || fresh.status === "submitted") {
        submitted = true;
        return;
      }
      await database.run(
        `INSERT INTO answers (id, assessment_id, question_id, value)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(assessment_id, question_id)
         DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [randomUUID(), id, questionId, value],
      );
      await database.run("UPDATE assessments SET status = 'in_progress' WHERE id = ? AND status = 'not_started'", [id]);
    });
  } catch {
    return error("Your answer couldn’t be saved. Please try again.", 500);
  }
  if (submitted) return error("Submitted assessments can’t be changed.", 409);
  return NextResponse.json({ saved: true });
}
