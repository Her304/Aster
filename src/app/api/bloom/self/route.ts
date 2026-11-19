import { NextResponse } from "next/server";
import { currentUser } from "@/lib/accounts";
import { parseAnswers, parseTiebreaks, scoreBloom } from "@/lib/bloom";
import { getSurveyByOwner, insertResponse } from "@/lib/bloom-data";
import { transaction } from "@/lib/db";
import { error, isCrossSite } from "@/lib/http";

export const runtime = "nodejs";

/** Saves (or replaces) the initiator's answers about themselves, which open the behaviour comparison. */
export async function PUT(request: Request) {
  if (isCrossSite(request)) return error("Cross-site request refused.", 403);
  const user = await currentUser();
  if (!user) return error("Sign in first.", 401);
  const survey = await getSurveyByOwner(user.id);
  if (!survey) return error("Create your survey first.", 404);
  const body = await request.json().catch(() => ({}));
  const answers = parseAnswers(body.answers);
  if (!answers) return error("Answer all sixteen questions. “Not sure” is fine.");
  const scored = scoreBloom(answers, parseTiebreaks(body.tiebreaks));
  if (!scored.type) return NextResponse.json({ error: "Settle the either-or questions first.", undecided: scored.missing }, { status: 409 });

  await transaction(async (database) => {
    await database.run("DELETE FROM survey_responses WHERE survey_id = ? AND is_owner = 1", [survey.id]);
    await insertResponse(database, {
      surveyId: survey.id,
      visitorId: null,
      userId: user.id,
      isOwner: true,
      name: survey.display_name,
      relation: "other",
      type: scored.type!,
      answers,
    });
  });
  return NextResponse.json({ type: scored.type });
}
