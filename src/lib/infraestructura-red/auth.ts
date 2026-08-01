import { NextResponse } from "next/server";
import { getFullSession, type SessionUser } from "@/lib/auth";
import { puedeAccederInfraestructura } from "./labels";

export async function requireInfraSession(): Promise<
  { ok: true; session: SessionUser } | { ok: false; response: NextResponse }
> {
  const session = await getFullSession();
  if (!session || !puedeAccederInfraestructura(session.rol)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}
