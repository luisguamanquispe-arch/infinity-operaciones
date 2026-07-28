import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";

export const runtime = "nodejs";

/** Ubicaciones GPS en vivo de técnicos (mapa supervisor). */
export async function GET() {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tecnicos = await prisma.tecnico.findMany({
    where: { usuario: { activo: true } },
    include: {
      usuario: { select: { nombre: true } },
      ubicaciones: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: { timestamp: true, precision: true },
      },
    },
    orderBy: { usuario: { nombre: "asc" } },
  });

  const ahora = Date.now();

  return NextResponse.json(
    {
      ts: ahora,
      tecnicos: tecnicos.map((t) => {
        const lastAt = t.ubicaciones[0]?.timestamp?.getTime() ?? null;
        const ageSec = lastAt != null ? Math.round((ahora - lastAt) / 1000) : null;
        const stale = ageSec == null || ageSec > 120;
        return {
          id: t.id,
          nombre: t.usuario.nombre,
          estado: t.estadoActual,
          lat: t.lat,
          lng: t.lng,
          ubicacionEn: t.ubicaciones[0]?.timestamp?.toISOString() ?? null,
          ageSec,
          stale,
          enVivo: !stale && t.lat != null && t.lng != null,
          precision: t.ubicaciones[0]?.precision ?? null,
        };
      }),
    },
    {
      headers: { "Cache-Control": "private, no-cache, max-age=0" },
    }
  );
}
