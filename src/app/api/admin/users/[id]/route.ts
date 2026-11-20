import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, adminNotConfigured, adminUnauthorized, isAdminRequest } from "@/lib/admin";
import { isoTime } from "@/lib/bloom-data";
import { queryAll, queryOne } from "@/lib/db";
import { error } from "@/lib/http";

export const runtime = "nodejs";

type Time = string | Date;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!adminConfigured()) return adminNotConfigured();
  if (!(await isAdminRequest(request))) return adminUnauthorized();

  const { id } = await params;
  const user = await queryOne<{ id: string; email: string; created_at: Time }>(
    "SELECT id, email, created_at FROM users WHERE id = ?",
    [id],
  );
  if (!user) return error("No such account.", 404);

  const [sessions, survey, given, visitors] = await Promise.all([
    queryAll<{ created_at: Time; expires_at: number | string }>(
      "SELECT created_at, expires_at FROM user_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
      [id],
    ),
    queryOne<{
      id: string;
      code: string;
      display_name: string;
      self_type: string;
      status: string;
      board_public: number;
      notify: number;
      notified_level: number | string;
      locale: string;
      created_at: Time;
    }>(
      `SELECT id, code, display_name, self_type, status, board_public, notify, notified_level, locale, created_at
       FROM surveys WHERE owner_id = ?`,
      [id],
    ),
    queryAll<{ code: string; owner_name: string; respondent_name: string; relation: string; result_type: string; submitted_at: Time }>(
      `SELECT s.code, s.display_name AS owner_name, r.respondent_name, r.relation, r.result_type, r.submitted_at
       FROM survey_responses r JOIN surveys s ON s.id = r.survey_id
       WHERE r.user_id = ? AND r.is_owner = 0
       ORDER BY r.submitted_at DESC`,
      [id],
    ),
    queryOne<{ count: number | string }>("SELECT COUNT(*) AS count FROM visitors WHERE user_id = ?", [id]),
  ]);

  const responses = survey
    ? await queryAll<{ respondent_name: string; relation: string; result_type: string; is_owner: number; user_id: string | null; submitted_at: Time }>(
        `SELECT respondent_name, relation, result_type, is_owner, user_id, submitted_at
         FROM survey_responses WHERE survey_id = ? ORDER BY submitted_at DESC`,
        [survey.id],
      )
    : [];
  const ownAnswer = responses.find((response) => Number(response.is_owner));
  const now = Date.now();

  return NextResponse.json({
    user: { id: user.id, email: user.email, createdAt: isoTime(user.created_at), linkedBrowsers: Number(visitors?.count || 0) },
    sessions: sessions.map((session) => ({
      createdAt: isoTime(session.created_at),
      expiresAt: new Date(Number(session.expires_at)).toISOString(),
      active: Number(session.expires_at) > now,
    })),
    survey: survey
      ? {
          code: survey.code,
          displayName: survey.display_name,
          selfType: survey.self_type,
          selfTestType: ownAnswer?.result_type ?? null,
          status: survey.status,
          boardPublic: Boolean(Number(survey.board_public)),
          notify: Boolean(Number(survey.notify)),
          notifiedLevel: Number(survey.notified_level),
          locale: survey.locale,
          createdAt: isoTime(survey.created_at),
          responses: responses
            .filter((response) => !Number(response.is_owner))
            .map((response) => ({
              name: response.respondent_name,
              relation: response.relation,
              type: response.result_type,
              signedIn: Boolean(response.user_id),
              submittedAt: isoTime(response.submitted_at),
            })),
        }
      : null,
    answersGiven: given.map((answer) => ({
      surveyCode: answer.code,
      ownerName: answer.owner_name,
      answeredAs: answer.respondent_name,
      relation: answer.relation,
      type: answer.result_type,
      submittedAt: isoTime(answer.submitted_at),
    })),
  });
}
