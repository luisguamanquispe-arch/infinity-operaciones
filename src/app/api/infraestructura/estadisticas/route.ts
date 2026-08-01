import { NextResponse } from "next/server";
import { requireInfraSession } from "@/lib/infraestructura-red/auth";
import { puedeGestionarInfraestructura } from "@/lib/infraestructura-red/labels";
import { obtenerIrEstadisticas, obtenerIrKpis } from "@/lib/infraestructura-red/stats";

export async function GET() {
  const auth = await requireInfraSession();
  if (!auth.ok) return auth.response;
  if (!puedeGestionarInfraestructura(auth.session.rol)) {
    return NextResponse.json({ error: "Solo supervisor/admin" }, { status: 403 });
  }

  const [kpis, estadisticas] = await Promise.all([obtenerIrKpis(), obtenerIrEstadisticas()]);
  return NextResponse.json({ kpis, estadisticas });
}
