import { NextResponse } from "next/server";
import { clearSessionCookie, sessionCookieOptions } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
