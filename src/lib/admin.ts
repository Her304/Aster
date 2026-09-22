import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { error } from "@/lib/http";

export const ADMIN_COOKIE = "aster_admin";

// Admin endpoints stay hidden entirely when no token is configured.
export function adminConfigured() {
  return Boolean(process.env.ADMIN_TOKEN);
}

function tokenDigest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function adminTokenValid(candidate: string | undefined | null) {
  if (!candidate || !process.env.ADMIN_TOKEN) return false;
  return timingSafeEqual(tokenDigest(candidate), tokenDigest(process.env.ADMIN_TOKEN));
}

export async function isAdminRequest(request: NextRequest) {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  if (adminTokenValid(bearer)) return true;
  return adminTokenValid(request.cookies.get(ADMIN_COOKIE)?.value);
}

export function adminSessionCookie(value: string) {
  return {
    name: ADMIN_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

export function clearAdminSessionCookie() {
  return {
    name: ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export function adminNotConfigured() {
  return error("Not found.", 404);
}

export function adminUnauthorized() {
  return error("Admin token required.", 401);
}
