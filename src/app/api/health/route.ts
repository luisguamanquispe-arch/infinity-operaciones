import { NextResponse } from "next/server";

/** Respuesta mínima para health check y keep-alive (evita cold start prolongado). */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "infinity-operaciones",
      gitSha: process.env.GIT_SHA || "unknown",
      ts: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
