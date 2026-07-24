import { NextResponse } from "next/server";
import { requireClienteSession } from "@/lib/cliente-app/auth";

export async function GET(request: Request) {
  try {
    await requireClienteSession(request);
    return NextResponse.json({ ok: true, t: Date.now() });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
