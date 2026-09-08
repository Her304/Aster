import { NextRequest, NextResponse } from "next/server";
import {
  getAssessmentsForReviewer,
  getRoomByCode,
  getRoomParticipants,
  roomCompletion,
} from "@/lib/db";
import { error } from "@/lib/http";
import { currentParticipant } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = getRoomByCode(code);
  if (!room) return error("Room not found.", 404);
  const participant = await currentParticipant(room.id);
  if (!participant) return error("This private room doesn’t recognize this browser.", 401);

  const participants = getRoomParticipants(room.id);
  const completion = roomCompletion(room.id);
  const completionByReviewer = new Map(completion.map((row) => [row.reviewer_id, row]));
  const members = participants.map((member) => ({
    id: member.id,
    nickname: member.nickname,
    isHost: member.id === room.host_participant_id,
    requiredDone: completionByReviewer.get(member.id)?.required_done ?? 0,
    requiredTotal: completionByReviewer.get(member.id)?.required_total ?? 0,
  }));
  const assessments = room.status === "lobby" ? [] : getAssessmentsForReviewer(room.id, participant.id);

  return NextResponse.json({
    room: {
      code: room.code,
      status: room.status,
      isDemo: Boolean(room.is_demo),
      createdAt: room.created_at,
    },
    me: {
      id: participant.id,
      nickname: participant.nickname,
      isHost: participant.id === room.host_participant_id,
    },
    members,
    assessments: assessments.map((assessment) => ({
      id: assessment.id,
      targetId: assessment.target_id,
      targetName: assessment.target_name,
      isSelf: Boolean(assessment.is_self),
      status: assessment.status,
      answerCount: Number(assessment.answer_count || 0),
    })),
    inviteUrl: `${request.nextUrl.origin}/?join=${room.code}`,
  });
}
