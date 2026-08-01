import { NextResponse } from "next/server";
import { requireSrSession } from "@/lib/soporte-remoto/auth";
import { obtenerEstadisticasSr } from "@/lib/soporte-remoto/stats";

function parseDate(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  try {
    const stats = await obtenerEstadisticasSr(
      parseDate(searchParams.get("desde")),
      parseDate(searchParams.get("hasta"))
    );
    return NextResponse.json({ stats });
  } catch (err) {
    console.error("[help-desk estadisticas]", err);
    return NextResponse.json({ error: "Error al calcular estadísticas" }, { status: 500 });
  }
}
