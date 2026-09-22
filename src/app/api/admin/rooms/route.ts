import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, adminNotConfigured, adminUnauthorized, isAdminRequest } from "@/lib/admin";
import { queryAll, queryOne } from "@/lib/db";

export const runtime = "nodejs";

interface AdminRoomRow {
  id: string;
  code: string;
  status: "lobby" | "survey" | "revealed";
  is_demo: number;
  created_at: string | Date;
  participants: number | string;
  assessments: number | string;
  submitted: number | string;
  total_count: number | string;
}

export async function GET(request: NextRequest) {
  if (!adminConfigured()) return adminNotConfigured();
  if (!(await isAdminRequest(request))) return adminUnauthorized();

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toUpperCase();
  const status = url.searchParams.get("status") || "";
  const includeDemo = url.searchParams.get("demo") === "1";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (!includeDemo) conditions.push("r.is_demo = 0");
  if (q) {
    conditions.push("r.code LIKE ?");
    params.push(`${q.replace(/[^A-Z2-9]/g, "").slice(0, 6)}%`);
  }
  if (status && ["lobby", "survey", "revealed"].includes(status)) {
    conditions.push("r.status = ?");
    params.push(status);
  }
  const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await queryAll<AdminRoomRow>(
    `SELECT r.id, r.code, r.status, r.is_demo, r.created_at,
       (SELECT COUNT(*) FROM participants p WHERE p.room_id = r.id) AS participants,
       (SELECT COUNT(*) FROM assessments a WHERE a.room_id = r.id) AS assessments,
       (SELECT COUNT(*) FROM assessments a WHERE a.room_id = r.id AND a.status = 'submitted') AS submitted,
       COUNT(*) OVER() AS total_count
     FROM rooms r
     ${whereSql}
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const total = rows.length ? Number(rows[0].total_count) : await countRooms();
  const iso = (value: string | Date) => (value instanceof Date ? value.toISOString() : value);
  return NextResponse.json({
    total,
    rooms: rows.map((row) => ({
      id: row.id,
      code: row.code,
      status: row.status,
      isDemo: Boolean(row.is_demo),
      createdAt: iso(row.created_at),
      participants: Number(row.participants),
      assessments: Number(row.assessments),
      submitted: Number(row.submitted),
    })),
  });
}

async function countRooms() {
  const row = await queryOne<{ count: number | string }>("SELECT COUNT(*) AS count FROM rooms WHERE is_demo = 0");
  return Number(row?.count || 0);
}
