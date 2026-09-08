import { NextResponse } from "next/server";
import { getRoomByCode, getRoomParticipants, queryAll } from "@/lib/db";
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

async function scoreReview(assessmentId: string) {
  const answers = await queryAll<{ question_id: number; value: number }>(
    "SELECT question_id, value FROM answers WHERE assessment_id = ?",
    [assessmentId],
  );
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
  const room = await getRoomByCode(code);
  if (!room) return error("Room not found.", 404);
  const participant = await currentParticipant(room.id);
  if (!participant) return error("You’re not a member of this room.", 401);
  if (room.status !== "revealed") return error("Results stay sealed until every friend assessment is complete.", 423);

  const rows = await queryAll<ReviewRow>(`
      SELECT a.id, a.reviewer_id, a.target_id, a.is_self,
        reviewer.nickname AS reviewer_name, target.nickname AS target_name
      FROM assessments a
      JOIN participants reviewer ON reviewer.id = a.reviewer_id
      JOIN participants target ON target.id = a.target_id
      WHERE a.room_id = ? AND a.status = 'submitted'
      ORDER BY reviewer.created_at
    `, [room.id]);
  const scored = await Promise.all(rows.map(async (row) => ({ ...row, profile: await scoreReview(row.id) })));
  const people = (await getRoomParticipants(room.id)).map((person) => {
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
