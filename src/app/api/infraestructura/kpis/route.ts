import { NextResponse } from "next/server";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";
import { obtenerIrKpis } from "@/lib/infraestructura-red/stats";

export async function GET() {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;

  const tecnicoId =
    auth.session.rol === "TECNICO" && auth.session.tecnicoId
      ? auth.session.tecnicoId
      : undefined;

  const kpis = await obtenerIrKpis(tecnicoId ? { tecnicoId } : undefined);
  return NextResponse.json({ kpis });
}
