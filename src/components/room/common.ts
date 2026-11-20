export type AssessmentStatus = "not_started" | "in_progress" | "submitted";

export interface RoomData {
  room: { code: string; status: "lobby" | "survey" | "revealed"; isDemo: boolean; createdAt: string };
  me: { id: string; nickname: string; isHost: boolean };
  members: Array<{
    id: string;
    nickname: string;
    isHost: boolean;
    requiredDone: number;
    requiredTotal: number;
  }>;
  /** This person's own assessments, in the order the flow visits them: themselves first, then friends by join order. */
  assessments: Array<{
    id: string;
    targetId: string;
    targetName: string;
    isSelf: boolean;
    status: AssessmentStatus;
    answerCount: number;
  }>;
  inviteUrl: string;
}

export interface AssessmentData {
  assessment: { id: string; targetName: string; isSelf: boolean; status: AssessmentStatus };
  answers: Record<number, number>;
}

export interface CompactProfile {
  type: string | null;
  contributingReviewerCount: number;
  closelyBalancedDimensions: string[];
  dimensions: Record<string, { score: number; preference: string; closelyBalanced: boolean; reviewerCount: number } | null>;
}

export interface ResultsData {
  people: Array<{
    id: string;
    nickname: string;
    isMe: boolean;
    overall: CompactProfile;
    self: CompactProfile | null;
    perspectives: Array<{ reviewerName: string; profile: CompactProfile }>;
  }>;
}

export const avatarColors = ["lilac", "moss", "clay", "sky", "butter"];

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
