import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createAssessments,
  createRoom,
  db,
  getRoomParticipants,
  hashToken,
  maybeRevealRoom,
  token,
} from "@/lib/db";
import { sessionCookie } from "@/lib/session";
import { SURVEY_QUESTIONS } from "@/lib/survey";
import { clientKey, error, isRateLimited } from "@/lib/http";

export const runtime = "nodejs";

const circle = ["Mina", "Jules", "Omar", "Ada", "Cleo"];
const baseTypes: Record<string, string> = {
  Mina: "INTP",
  Jules: "ENFJ",
  Omar: "ISTP",
  Ada: "ISFP",
  Cleo: "ENTJ",
};

function valueFor(question: (typeof SURVEY_QUESTIONS)[number], desiredType: string, index: number) {
  const desiredPole = desiredType.includes(question.positivePole);
  if (index % 7 === 0) return desiredPole ? 4 : 2;
  return desiredPole ? 5 : 1;
}

export async function POST(request: NextRequest) {
  if (isRateLimited(`demo:${clientKey(request)}`, 5)) return error("Please wait a minute before opening another sample room.", 429);
  db.prepare("DELETE FROM rooms WHERE is_demo = 1 AND created_at < datetime('now', '-6 hours')").run();
  const demoCount = db.prepare("SELECT COUNT(*) AS count FROM rooms WHERE is_demo = 1").get() as { count: number };
  if (demoCount.count >= 100) return error("The sample garden is busy. Please try again later.", 503);
  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "revealed" ? "revealed" : "active";
  const created = createRoom("Mina", true);

  for (const nickname of circle.slice(1)) {
    const participantToken = token();
    db.prepare(
      "INSERT INTO participants (id, room_id, nickname, session_hash, recovery_hash) VALUES (?, ?, ?, ?, ?)",
    ).run(
      randomUUID(),
      created.roomId,
      nickname,
      hashToken(participantToken),
      hashToken(token()),
    );
  }
  createAssessments(created.roomId);

  const participants = getRoomParticipants(created.roomId);
  const byId = new Map(participants.map((participant) => [participant.id, participant]));
  const assessments = db
    .prepare("SELECT id, reviewer_id, target_id, is_self FROM assessments WHERE room_id = ?")
    .all(created.roomId) as unknown as Array<{
    id: string;
    reviewer_id: string;
    target_id: string;
    is_self: number;
  }>;
  const insertAnswer = db.prepare(
    "INSERT INTO answers (id, assessment_id, question_id, value) VALUES (?, ?, ?, ?)",
  );

  db.exec("BEGIN");
  try {
    for (const assessment of assessments) {
      const reviewer = byId.get(assessment.reviewer_id)!;
      const target = byId.get(assessment.target_id)!;
      let desiredType = baseTypes[target.nickname];

      if (target.nickname === "Mina" && !assessment.is_self) {
        desiredType = { Jules: "INFJ", Omar: "INTP", Ada: "INTP", Cleo: "ENTP" }[reviewer.nickname] || "INTP";
      }

      let count = SURVEY_QUESTIONS.length;
      let submitted = true;
      if (kind === "active" && reviewer.nickname === "Mina") {
        if (target.nickname === "Cleo") {
          count = 18;
          submitted = false;
        } else if (assessment.is_self) {
          count = 30;
          submitted = false;
        }
      }

      SURVEY_QUESTIONS.slice(0, count).forEach((question, index) => {
        insertAnswer.run(randomUUID(), assessment.id, question.id, valueFor(question, desiredType, index));
      });
      db.prepare(
        submitted
          ? "UPDATE assessments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?"
          : "UPDATE assessments SET status = 'in_progress' WHERE id = ?",
      ).run(assessment.id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  maybeRevealRoom(created.roomId);
  const response = NextResponse.json({ code: created.code });
  response.cookies.set(sessionCookie(created.sessionToken));
  return response;
}
