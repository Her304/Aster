import { cookies } from "next/headers";
import { getParticipantBySession } from "@/lib/db";

export const SESSION_COOKIE = "aster_session";

export async function currentParticipant(roomId?: string) {
  return await getParticipantBySession((await cookies()).get(SESSION_COOKIE)?.value, roomId);
}

export function sessionCookie(value: string) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  };
}
