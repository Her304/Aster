import { NextResponse } from "next/server";
import { currentUser } from "@/lib/accounts";
import { getSurveyByOwner } from "@/lib/bloom-data";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null, survey: null });
  const survey = await getSurveyByOwner(user.id);
  return NextResponse.json({ user: { email: user.email }, survey: survey ? { code: survey.code } : null });
}
