import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/accounts";
import { THRESHOLDS, countFlowers, flowerFor, gapBadges, isPersonalityType, parseAnswers, parseTiebreaks, readAxes, responseSimilarity, scoreBloom } from "@/lib/bloom";
import {
  getSurveyByOwner,
  insertResponse,
  isoTime,
  listResponses,
  ownerSelfAnswers,
  respondentAnswers,
  surveyBoard,
  surveyCode,
} from "@/lib/bloom-data";
import { execute, transaction } from "@/lib/db";
import { cleanNickname, error, isCrossSite } from "@/lib/http";
import { mailLocale } from "@/lib/mailer";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) return error("Sign in first.", 401);
  const survey = await getSurveyByOwner(user.id);
  if (!survey) return NextResponse.json({ user: { email: user.email }, survey: null });
  const [responses, board, self, answers] = await Promise.all([
    listResponses(survey.id),
    surveyBoard(survey.id),
    ownerSelfAnswers(survey.id),
    respondentAnswers(survey.id),
  ]);
  return NextResponse.json({
    user: { email: user.email },
    survey: {
      code: survey.code,
      displayName: survey.display_name,
      selfType: survey.self_type,
      status: survey.status,
      boardPublic: Boolean(survey.board_public),
      notify: Boolean(survey.notify),
      createdAt: isoTime(survey.created_at),
      selfAnswered: Boolean(self),
    },
    board,
    badges: gapBadges(readAxes(survey.self_type, board), board.total),
    flowers: board.total >= THRESHOLDS.flowers ? countFlowers(survey.self_type, [...answers.values()]) : null,
    responses: responses.map((response) => ({
      id: response.id,
      name: response.respondent_name,
      relation: response.relation,
      type: response.result_type,
      flower: board.total >= THRESHOLDS.flowers ? flowerFor(responseSimilarity(survey.self_type, answers.get(response.id) ?? {})) : null,
      signedIn: Boolean(response.user_id),
      submittedAt: isoTime(response.submitted_at),
    })),
  });
}

export async function POST(request: Request) {
  if (isCrossSite(request)) return error("Cross-site request refused.", 403);
  const user = await currentUser();
  if (!user) return error("Sign in first.", 401);
  const body = await request.json().catch(() => ({}));
  const displayName = cleanNickname(body.displayName);
  if (!displayName) return error("Choose a name between 2 and 24 characters.");
  if (!isPersonalityType(body.selfType)) return error("Pick one letter on each of the four axes.");

  let selfAnswers = null;
  if (body.selfAnswers !== undefined && body.selfAnswers !== null) {
    selfAnswers = parseAnswers(body.selfAnswers);
    if (!selfAnswers) return error("Your own answers are incomplete.");
    if (!scoreBloom(selfAnswers, parseTiebreaks(body.selfTiebreaks)).type) return error("Settle the either-or questions first.");
  }

  let issue: NextResponse | undefined;
  let code = "";
  await transaction(async (database) => {
    if (await database.get("SELECT 1 FROM surveys WHERE owner_id = ?", [user.id])) {
      issue = error("This account already has a survey.", 409);
      return;
    }
    code = surveyCode();
    while (await database.get("SELECT 1 FROM surveys WHERE code = ?", [code])) code = surveyCode();
    const surveyId = randomUUID();
    await database.run(
      "INSERT INTO surveys (id, code, owner_id, display_name, self_type, notify, locale) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [surveyId, code, user.id, displayName, body.selfType, body.notify ? 1 : 0, mailLocale(body.locale)],
    );
    if (selfAnswers) {
      await insertResponse(database, {
        surveyId,
        visitorId: null,
        userId: user.id,
        isOwner: true,
        name: displayName,
        relation: "other",
        type: scoreBloom(selfAnswers, parseTiebreaks(body.selfTiebreaks)).type!,
        answers: selfAnswers,
      });
    }
  });
  if (issue) return issue;
  return NextResponse.json({ code });
}

export async function PATCH(request: Request) {
  if (isCrossSite(request)) return error("Cross-site request refused.", 403);
  const user = await currentUser();
  if (!user) return error("Sign in first.", 401);
  const survey = await getSurveyByOwner(user.id);
  if (!survey) return error("Create your survey first.", 404);
  const body = await request.json().catch(() => ({}));

  if (body.status !== undefined) {
    if (body.status !== "open" && body.status !== "closed") return error("Unknown status.");
    await execute("UPDATE surveys SET status = ? WHERE id = ?", [body.status, survey.id]);
  }
  if (body.boardPublic !== undefined) {
    await execute("UPDATE surveys SET board_public = ? WHERE id = ?", [body.boardPublic ? 1 : 0, survey.id]);
  }
  if (body.notify !== undefined) {
    await execute("UPDATE surveys SET notify = ?, locale = ? WHERE id = ?", [body.notify ? 1 : 0, mailLocale(body.locale), survey.id]);
  }
  if (body.selfType !== undefined) {
    if (!isPersonalityType(body.selfType)) return error("Pick one letter on each of the four axes.");
    await execute("UPDATE surveys SET self_type = ? WHERE id = ?", [body.selfType, survey.id]);
  }
  if (body.displayName !== undefined) {
    const displayName = cleanNickname(body.displayName);
    if (!displayName) return error("Choose a name between 2 and 24 characters.");
    await execute("UPDATE surveys SET display_name = ? WHERE id = ?", [displayName, survey.id]);
  }
  return NextResponse.json({ ok: true });
}

/** Deletes the survey and every answer to it; the account stays. */
export async function DELETE(request: Request) {
  if (isCrossSite(request)) return error("Cross-site request refused.", 403);
  const user = await currentUser();
  if (!user) return error("Sign in first.", 401);
  await execute("DELETE FROM surveys WHERE owner_id = ?", [user.id]);
  return NextResponse.json({ ok: true });
}
