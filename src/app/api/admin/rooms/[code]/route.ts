import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, adminNotConfigured, adminUnauthorized, isAdminRequest } from "@/lib/admin";
import { getRoomByCode, getRoomParticipants, queryAll } from "@/lib/db";

export const runtime = "nodejs";

interface AdminAssessmentRow {
  id: string;
  reviewer_id: string;
  target_id: string;
  is_self: number;
  status: string;
  submitted_at: string | Date | null;
  answer_count: number | string;
  reviewer_name?: string;
  target_name?: string;
}

interface AnswerRow {
  assessment_id: string;
  question_id: number;
  value: number;
  updated_at: string | Date;
}

const iso = (value: string | Date | null | undefined) =>
  value instanceof Date ? value.toISOString() : value ?? null;

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  if (!adminConfigured()) return adminNotConfigured();
  if (!(await isAdminRequest(request))) return adminUnauthorized();

  const { code } = await params;
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const includeAnswers = new URL(request.url).searchParams.get("answers") === "1";

  const participants = await getRoomParticipants(room.id);
  const assessments = await queryAll<AdminAssessmentRow>(
    `SELECT a.*, reviewer.nickname AS reviewer_name, target.nickname AS target_name,
       (SELECT COUNT(*) FROM answers ans WHERE ans.assessment_id = a.id) AS answer_count
     FROM assessments a
     JOIN participants reviewer ON reviewer.id = a.reviewer_id
     JOIN participants target ON target.id = a.target_id
     WHERE a.room_id = ?
     ORDER BY a.is_self, reviewer.nickname, target.nickname`,
    [room.id],
  );

  const nameById = new Map(participants.map((participant) => [participant.id, participant.nickname]));
  const answers = includeAnswers
    ? await queryAll<{ assessment_id: string; question_id: number; value: number; updated_at: string | Date }>(
        `SELECT ans.assessment_id, ans.question_id, ans.value, ans.updated_at
         FROM answers ans
         JOIN assessments a ON a.id = ans.assessment_id
         WHERE a.room_id = ?
         ORDER BY ans.assessment_id, ans.question_id`,
        [room.id],
      )
    : undefined;

  return NextResponse.json({
    room: {
      id: room.id,
      code: room.code,
      status: room.status,
      isDemo: Boolean(room.is_demo),
      createdAt: iso(room.created_at),
      questionnaireVersion: room.questionnaire_version,
    },
    participants: participants.map((participant) => ({
      id: participant.id,
      nickname: participant.nickname,
      createdAt: iso(participant.created_at),
    })),
    assessments: assessments.map((row) => ({
      id: row.id,
      reviewer: nameById.get(row.reviewer_id) ?? row.reviewer_name,
      target: nameById.get(row.target_id) ?? row.target_name,
      isSelf: Boolean(row.is_self),
      status: row.status,
      submittedAt: iso(row.submitted_at),
      answerCount: Number(row.answer_count || 0),
    })),
    answers: answers?.map((row) => ({
      assessmentId: row.assessment_id,
      questionId: row.question_id,
      value: row.value,
    })),
  });
}
