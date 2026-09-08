import { NextResponse } from "next/server";
import { db, getRoomByCode, getRoomParticipants } from "@/lib/db";
import { error } from "@/lib/http";
import { currentParticipant } from "@/lib/session";
import { averageReviewerScores, scoreAssessment, type ScoredProfile } from "@/lib/scoring";
import { SURVEY_QUESTIONS } from "@/lib/survey";

export const runtime = "nodejs";

interface ReviewRow {
  id: string;
  reviewer_id: string;
  target_id: string;
  reviewer_name: string;
  target_name: string;
  is_self: number;
}

function scoreReview(assessmentId: string) {
  const answers = db
    .prepare("SELECT question_id, value FROM answers WHERE assessment_id = ?")
    .all(assessmentId) as unknown as Array<{ question_id: number; value: number }>;
  const mapped = Object.fromEntries(
    answers.map((answer) => [answer.question_id, answer.value === 0 ? "not-sure" : answer.value]),
  );
  return scoreAssessment(SURVEY_QUESTIONS, mapped as never);
}

function compact(profile: ScoredProfile | null) {
  if (!profile) return null;
  return {
    type: profile.type,
    contributingReviewerCount: profile.contributingReviewerCount,
    closelyBalancedDimensions: profile.closelyBalancedDimensions,
    dimensions: Object.fromEntries(
      Object.entries(profile.dimensions).map(([key, dimension]) => [
        key,
        dimension
          ? {
              score: Math.round(dimension.score * 10) / 10,
              preference: dimension.preference,
              closelyBalanced: dimension.closelyBalanced,
              reviewerCount: dimension.reviewerCount,
            }
          : null,
      ]),
    ),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = getRoomByCode(code);
  if (!room) return error("Room not found.", 404);
  const participant = await currentParticipant(room.id);
  if (!participant) return error("You’re not a member of this room.", 401);
  if (room.status !== "revealed") return error("Results stay sealed until every friend assessment is complete.", 423);

  const rows = db
    .prepare(`
      SELECT a.id, a.reviewer_id, a.target_id, a.is_self,
        reviewer.nickname AS reviewer_name, target.nickname AS target_name
      FROM assessments a
      JOIN participants reviewer ON reviewer.id = a.reviewer_id
      JOIN participants target ON target.id = a.target_id
      WHERE a.room_id = ? AND a.status = 'submitted'
    `)
    .all(room.id) as unknown as ReviewRow[];
  const scored = rows.map((row) => ({ ...row, profile: scoreReview(row.id) }));
  const people = getRoomParticipants(room.id).map((person) => {
    const friendReviews = scored.filter((review) => review.target_id === person.id && !review.is_self);
    const selfReview = scored.find((review) => review.target_id === person.id && review.is_self);
    const overall = averageReviewerScores(friendReviews.map((review) => review.profile));
    const isMe = person.id === participant.id;
    return {
      id: person.id,
      nickname: person.nickname,
      isMe,
      overall: compact(overall),
      self: isMe ? compact(selfReview?.profile || null) : null,
      perspectives: isMe
        ? friendReviews.map((review) => ({ reviewerName: review.reviewer_name, profile: compact(review.profile) }))
        : [],
    };
  });

  return NextResponse.json({ people });
}
