import { NextResponse } from "next/server";

/** Respuesta mínima para health check y keep-alive (evita cold start prolongado). */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "lgb-operaciones", ts: Date.now() },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
