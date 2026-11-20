import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, adminNotConfigured, adminUnauthorized, isAdminRequest } from "@/lib/admin";
import { isoTime } from "@/lib/bloom-data";
import { queryAll, queryOne } from "@/lib/db";

export const runtime = "nodejs";

interface AdminUserRow {
  id: string;
  email: string;
  created_at: string | Date;
  last_sign_in: string | Date | null;
  active_sessions: number | string;
  survey_code: string | null;
  survey_name: string | null;
  self_type: string | null;
  survey_status: string | null;
  responses_received: number | string;
  answers_given: number | string;
  total_count: number | string;
}

export async function GET(request: NextRequest) {
  if (!adminConfigured()) return adminNotConfigured();
  if (!(await isAdminRequest(request))) return adminUnauthorized();

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase().replace(/[%_\\]/g, "").slice(0, 254);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const rows = await queryAll<AdminUserRow>(
    `SELECT u.id, u.email, u.created_at,
       (SELECT MAX(s.created_at) FROM user_sessions s WHERE s.user_id = u.id) AS last_sign_in,
       (SELECT COUNT(*) FROM user_sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS active_sessions,
       sv.code AS survey_code, sv.display_name AS survey_name, sv.self_type, sv.status AS survey_status,
       (SELECT COUNT(*) FROM survey_responses r WHERE r.survey_id = sv.id AND r.is_owner = 0) AS responses_received,
       (SELECT COUNT(*) FROM survey_responses r WHERE r.user_id = u.id AND r.is_owner = 0) AS answers_given,
       COUNT(*) OVER() AS total_count
     FROM users u LEFT JOIN surveys sv ON sv.owner_id = u.id
     ${q ? "WHERE u.email LIKE ?" : ""}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [Date.now(), ...(q ? [`%${q}%`] : []), limit, offset],
  );

  const total = rows.length ? Number(rows[0].total_count) : Number((await queryOne<{ count: number | string }>("SELECT COUNT(*) AS count FROM users"))?.count || 0);
  return NextResponse.json({
    total,
    users: rows.map((row) => ({
      id: row.id,
      email: row.email,
      createdAt: isoTime(row.created_at),
      lastSignInAt: row.last_sign_in ? isoTime(row.last_sign_in) : null,
      activeSessions: Number(row.active_sessions),
      survey: row.survey_code
        ? { code: row.survey_code, displayName: row.survey_name, selfType: row.self_type, status: row.survey_status }
        : null,
      responsesReceived: Number(row.responses_received),
      answersGiven: Number(row.answers_given),
    })),
  });
}
