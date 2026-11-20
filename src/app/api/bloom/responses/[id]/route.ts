import { NextResponse } from "next/server";
import { currentUser } from "@/lib/accounts";
import { getSurveyByOwner } from "@/lib/bloom-data";
import { execute } from "@/lib/db";
import { error, isCrossSite } from "@/lib/http";

export const runtime = "nodejs";

/** Lets the initiator remove an answer, such as a duplicate sent from a private window. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isCrossSite(request)) return error("Cross-site request refused.", 403);
  const { id } = await params;
  const user = await currentUser();
  if (!user) return error("Sign in first.", 401);
  const survey = await getSurveyByOwner(user.id);
  if (!survey) return error("Create your survey first.", 404);
  const { changes } = await execute("DELETE FROM survey_responses WHERE id = ? AND survey_id = ? AND is_owner = 0", [
    id,
    survey.id,
  ]);
  if (!changes) return error("That answer wasn’t found.", 404);
  return NextResponse.json({ ok: true });
}
