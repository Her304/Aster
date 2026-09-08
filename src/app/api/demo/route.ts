import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createAssessments,
  createRoom,
  type DbExecutor,
  getRoomParticipants,
  hashToken,
  maybeRevealRoom,
  token,
  transaction,
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

async function insertAnswers(
  database: DbExecutor,
  rows: Array<{ id: string; assessmentId: string; questionId: number; value: number }>,
) {
  const chunkSize = 200;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    await database.run(
      `INSERT INTO answers (id, assessment_id, question_id, value)
       VALUES ${chunk.map(() => "(?, ?, ?, ?)").join(", ")}`,
      chunk.flatMap((row) => [row.id, row.assessmentId, row.questionId, row.value]),
    );
  }
}

export async function POST(request: NextRequest) {
  if (isRateLimited(`demo:${clientKey(request)}`, 5)) {
    return error("Please wait a minute before opening another sample room.", 429);
  }
  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "revealed" ? "revealed" : "active";
  let busy = false;
  let created: Awaited<ReturnType<typeof createRoom>> | undefined;

  try {
    await transaction(async (database) => {
      const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const cutoffValue =
        database.dialect === "postgres"
          ? cutoff.toISOString()
          : cutoff.toISOString().replace("T", " ").slice(0, 19);
      await database.run("DELETE FROM rooms WHERE is_demo = 1 AND created_at < ?", [cutoffValue]);
      const demoCount = await database.get<{ count: number | string }>(
        "SELECT COUNT(*) AS count FROM rooms WHERE is_demo = 1",
      );
      if (Number(demoCount?.count || 0) >= 100) {
        busy = true;
        return;
      }

      created = await createRoom("Mina", true, database);
      for (const nickname of circle.slice(1)) {
        const participantToken = token();
        await database.run(
          "INSERT INTO participants (id, room_id, nickname, session_hash, recovery_hash) VALUES (?, ?, ?, ?, ?)",
          [randomUUID(), created.roomId, nickname, hashToken(participantToken), hashToken(token())],
        );
      }
      await createAssessments(created.roomId, database);

      const participants = await getRoomParticipants(created.roomId, database);
      const byId = new Map(participants.map((participant) => [participant.id, participant]));
      const assessments = await database.all<{
        id: string;
        reviewer_id: string;
        target_id: string;
        is_self: number;
      }>("SELECT id, reviewer_id, target_id, is_self FROM assessments WHERE room_id = ?", [created.roomId]);
      const answerRows: Array<{ id: string; assessmentId: string; questionId: number; value: number }> = [];

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
          answerRows.push({
            id: randomUUID(),
            assessmentId: assessment.id,
            questionId: question.id,
            value: valueFor(question, desiredType, index),
          });
        });
        await database.run(
          submitted
            ? "UPDATE assessments SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP WHERE id = ?"
            : "UPDATE assessments SET status = 'in_progress' WHERE id = ?",
          [assessment.id],
        );
      }

      await insertAnswers(database, answerRows);
      await maybeRevealRoom(created.roomId, database);
    });
  } catch {
    return error("The sample circle couldn’t be opened. Please try again.", 500);
  }

  if (busy || !created) return error("The sample garden is busy. Please try again later.", 503);
  const response = NextResponse.json({ code: created.code });
  response.cookies.set(sessionCookie(created.sessionToken));
  return response;
}
