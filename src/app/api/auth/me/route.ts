import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";

export async function GET() {
  const session = await getFullSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: session });
}
