import { NextResponse, after } from "next/server";
import { createVisitor, currentUser, currentVisitor, visitorCookie } from "@/lib/accounts";
import { THRESHOLDS, flowerFor, isRelation, parseAnswers, parseTiebreaks, responseSimilarity, scoreBloom } from "@/lib/bloom";
import { findOwnResponse, getSurveyByCode, insertResponse, isoTime, notifyMilestone, responseAnswers, surveyBoard } from "@/lib/bloom-data";
import { transaction } from "@/lib/db";
import { cleanNickname, clientKey, error, isCrossSite, isRateLimited } from "@/lib/http";

export const runtime = "nodejs";

type Params = { params: Promise<{ code: string }> };

/**
 * What one viewer may see of a survey. The initiator's type and the ranking
 * appear only after this browser (or account) has answered; the ranking also
 * waits for enough answers that no single one can be picked out.
 */
export async function GET(_request: Request, { params }: Params) {
  const { code } = await params;
  const survey = await getSurveyByCode(code);
  if (!survey) return error("This survey link doesn’t exist.", 404);
  const [user, visitor] = await Promise.all([currentUser(), currentVisitor()]);
  const isOwner = user?.id === survey.owner_id;
  const own = isOwner ? undefined : await findOwnResponse(survey.id, visitor?.id, user?.id);
  const board = await surveyBoard(survey.id);
  const canSeeBoard = isOwner || (own !== undefined && Boolean(survey.board_public));
  // A respondent sees their own flower as soon as they finish; the initiator's
  // view of everyone's flowers waits for THRESHOLDS.flowers answers.
  const similarity = own ? responseSimilarity(survey.self_type, await responseAnswers(own.id)) : null;

  return NextResponse.json({
    survey: { code: survey.code, displayName: survey.display_name, status: survey.status },
    viewer: { isOwner, signedIn: Boolean(user) },
    total: board.total,
    boardThreshold: THRESHOLDS.board,
    boardPublic: Boolean(survey.board_public),
    response: own
      ? {
          name: own.respondent_name,
          relation: own.relation,
          type: own.result_type,
          submittedAt: isoTime(own.submitted_at),
          similarity,
          flower: flowerFor(similarity),
        }
      : null,
    selfType: isOwner || own ? survey.self_type : null,
    board: canSeeBoard && (isOwner || board.total >= THRESHOLDS.board) ? board : null,
  });
}

export async function POST(request: Request, { params }: Params) {
  if (isCrossSite(request)) return error("Cross-site request refused.", 403);
  if (isRateLimited(`respond:${clientKey(request)}`, 20)) return error("Too many answers from here. Please wait a minute.", 429);
  const { code } = await params;
  const survey = await getSurveyByCode(code);
  if (!survey) return error("This survey link doesn’t exist.", 404);
  if (survey.status !== "open") return error("This survey has closed.", 409);

  const [user, visitor] = await Promise.all([currentUser(), currentVisitor()]);
  if (user?.id === survey.owner_id) return error("This is your own survey.", 403);
  const body = await request.json().catch(() => ({}));
  const name = cleanNickname(body.name);
  if (!name) return error("Choose a name between 2 and 24 characters.");
  if (!isRelation(body.relation)) return error("Choose how you know them.");
  const answers = parseAnswers(body.answers);
  if (!answers) return error("Answer all sixteen questions. “Not sure” is fine.");
  const scored = scoreBloom(answers, parseTiebreaks(body.tiebreaks));
  if (!scored.type) {
    return NextResponse.json({ error: "Settle the either-or questions first.", undecided: scored.missing }, { status: 409 });
  }

  let freshVisitor: { id: string; token: string } | undefined;
  if (!visitor) freshVisitor = await createVisitor(user?.id ?? null);
  const visitorId = visitor?.id ?? freshVisitor!.id;

  let duplicate = false;
  await transaction(async (database) => {
    const existing = await database.get(
      "SELECT 1 FROM survey_responses WHERE survey_id = ? AND is_owner = 0 AND (visitor_id = ? OR user_id = ?)",
      [survey.id, visitorId, user?.id ?? ""],
    );
    if (existing) {
      duplicate = true;
      return;
    }
    await insertResponse(database, {
      surveyId: survey.id,
      visitorId,
      userId: user?.id ?? null,
      isOwner: false,
      name,
      relation: body.relation,
      type: scored.type!,
      answers,
    });
  });

  if (!duplicate) {
    const origin = new URL(request.url).origin;
    after(() => notifyMilestone(survey.id, origin).catch((caught) => console.error("[aster] milestone email failed", caught)));
  }
  const response = duplicate
    ? error("You’ve already answered this survey.", 409)
    : NextResponse.json({ type: scored.type });
  if (freshVisitor) response.cookies.set(visitorCookie(freshVisitor.token));
  return response;
}
