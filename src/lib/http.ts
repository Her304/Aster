import { NextResponse } from "next/server";

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function cleanNickname(input: unknown) {
  if (typeof input !== "string") return null;
  const value = input.trim().replace(/\s+/g, " ");
  if (value.length < 2 || value.length > 24) return null;
  if (!/^[\p{L}\p{N} ._'’-]+$/u.test(value)) return null;
  return value;
}

const requestBuckets = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs = 60_000) {
  if (requestBuckets.size > 10_000) requestBuckets.clear();
  const now = Date.now();
  const recent = (requestBuckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= limit) {
    requestBuckets.set(key, recent);
    return true;
  }
  recent.push(now);
  requestBuckets.set(key, recent);
  return false;
}

export function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
