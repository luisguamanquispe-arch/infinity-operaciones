import { NextResponse } from "next/server";
import { getFullSession } from "@/lib/auth";
import { obtenerSiEstadisticas, obtenerSiKpis } from "@/lib/soporte-infraestructura/stats";

export async function GET() {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const [kpis, estadisticas] = await Promise.all([obtenerSiKpis(), obtenerSiEstadisticas()]);
  return NextResponse.json({ kpis, estadisticas });
}
