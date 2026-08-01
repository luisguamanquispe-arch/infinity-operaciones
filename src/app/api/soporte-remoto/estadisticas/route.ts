import { NextResponse } from "next/server";
import { requireSrSession } from "@/lib/soporte-remoto/auth";
import { obtenerEstadisticasSr } from "@/lib/soporte-remoto/stats";

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const auth = await requireSrSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const desde = parseDate(searchParams.get("desde"));
  const hasta = parseDate(searchParams.get("hasta"));

  try {
    const stats = await obtenerEstadisticasSr(desde, hasta);
    return NextResponse.json({ stats });
  } catch (err) {
    console.error("[soporte-remoto estadisticas]", err);
    return NextResponse.json({ error: "Error al calcular estadísticas" }, { status: 500 });
  }
}
