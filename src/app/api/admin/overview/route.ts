import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, adminNotConfigured, adminUnauthorized, isAdminRequest } from "@/lib/admin";
import { transaction } from "@/lib/db";

export const runtime = "nodejs";

interface OverviewRow {
  rooms: number | string;
  real_rooms: number | string;
  demo_rooms: number | string;
  revealed_rooms: number | string;
  participants: number | string;
  assessments: number | string;
  submitted_assessments: number | string;
  answers: number | string;
  rooms_last_24h: number | string;
  rooms_last_7d: number | string;
  participants_last_24h: number | string;
  accounts: number | string;
  accounts_last_7d: number | string;
  surveys: number | string;
  survey_responses: number | string;
}

export async function GET(request: NextRequest) {
  if (!adminConfigured()) return adminNotConfigured();
  if (!(await isAdminRequest(request))) return adminUnauthorized();

  const stats = await transaction(async (database) => {
    const day = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const isoFor = (date: Date) =>
      database.dialect === "postgres" ? date.toISOString() : date.toISOString().replace("T", " ").slice(0, 19);

    return database.get<OverviewRow>(
      `SELECT
         (SELECT COUNT(*) FROM rooms) AS rooms,
         (SELECT COUNT(*) FROM rooms WHERE is_demo = 0) AS real_rooms,
         (SELECT COUNT(*) FROM rooms WHERE is_demo = 1) AS demo_rooms,
         (SELECT COUNT(*) FROM rooms WHERE status = 'revealed') AS revealed_rooms,
         (SELECT COUNT(*) FROM participants) AS participants,
         (SELECT COUNT(*) FROM assessments) AS assessments,
         (SELECT COUNT(*) FROM assessments WHERE status = 'submitted') AS submitted_assessments,
         (SELECT COUNT(*) FROM answers) AS answers,
         (SELECT COUNT(*) FROM rooms WHERE created_at > ?) AS rooms_last_24h,
         (SELECT COUNT(*) FROM rooms WHERE created_at > ?) AS rooms_last_7d,
         (SELECT COUNT(*) FROM participants WHERE created_at > ?) AS participants_last_24h,
         (SELECT COUNT(*) FROM users) AS accounts,
         (SELECT COUNT(*) FROM users WHERE created_at > ?) AS accounts_last_7d,
         (SELECT COUNT(*) FROM surveys) AS surveys,
         (SELECT COUNT(*) FROM survey_responses WHERE is_owner = 0) AS survey_responses`,
      [isoFor(day), isoFor(week), isoFor(day), isoFor(week)],
    );
  });

  const number = (value: number | string | undefined) => Number(value || 0);
  return NextResponse.json({
    rooms: number(stats?.rooms),
    realRooms: number(stats?.real_rooms),
    demoRooms: number(stats?.demo_rooms),
    revealedRooms: number(stats?.revealed_rooms),
    participants: number(stats?.participants),
    assessments: number(stats?.assessments),
    submittedAssessments: number(stats?.submitted_assessments),
    answers: number(stats?.answers),
    roomsLast24h: number(stats?.rooms_last_24h),
    roomsLast7d: number(stats?.rooms_last_7d),
    participantsLast24h: number(stats?.participants_last_24h),
    accounts: number(stats?.accounts),
    accountsLast7d: number(stats?.accounts_last_7d),
    surveys: number(stats?.surveys),
    surveyResponses: number(stats?.survey_responses),
  });
}
