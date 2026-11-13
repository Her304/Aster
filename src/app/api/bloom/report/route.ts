import { NextResponse } from "next/server";
import { currentUser } from "@/lib/accounts";
import { getSurveyByOwner, surveyReport } from "@/lib/bloom-data";
import { error } from "@/lib/http";

export const runtime = "nodejs";

/** The misalignment report. Only the initiator can read it; it carries no respondent names. */
export async function GET() {
  const user = await currentUser();
  if (!user) return error("Sign in first.", 401);
  const survey = await getSurveyByOwner(user.id);
  if (!survey) return error("Create your survey first.", 404);
  return NextResponse.json({ displayName: survey.display_name, report: await surveyReport(survey) });
}
