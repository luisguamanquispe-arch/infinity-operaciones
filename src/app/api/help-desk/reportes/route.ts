import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HelpDeskAuthError, puedeSupervisarHelpDesk, requireHelpDeskSession } from "@/lib/help-desk/auth";

export async function GET(request: Request) {
  try {
    const session = await requireHelpDeskSession();
    if (!puedeSupervisarHelpDesk(session.rol)) {
      return NextResponse.json({ error: "Solo supervisores" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dias = Math.min(90, Math.max(1, parseInt(searchParams.get("dias") || "30", 10)));
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);
    desde.setHours(0, 0, 0, 0);

    const [conversaciones, acciones, escalados, agentes] = await Promise.all([
      prisma.hdConversacion.findMany({
        where: { createdAt: { gte: desde } },
        select: {
          estado: true,
          createdAt: true,
          cerradoEn: true,
          asignadoAId: true,
          clienteId: true,
          satisfaccion: true,
        },
      }),
      prisma.hdAccionRemota.groupBy({
        by: ["tipo"],
        where: { createdAt: { gte: desde } },
        _count: { id: true },
      }),
      prisma.hdEscalamiento.count({ where: { createdAt: { gte: desde } } }),
      prisma.usuario.findMany({
        where: { rol: { in: ["HELP_DESK", "ADMIN", "SUPERVISOR"] } },
        select: { id: true, nombre: true },
      }),
    ]);

    const resueltos = conversaciones.filter((c) => c.estado === "RESUELTO").length;
    const escaladosCount = conversaciones.filter((c) => c.estado === "ESCALADO").length;
    const cerradas = conversaciones.filter((c) => c.cerradoEn);
    const tiempos = cerradas.map((c) => c.cerradoEn!.getTime() - c.createdAt.getTime());
    const tiempoPromedioResolucionMin =
      tiempos.length > 0
        ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length / 60000)
        : 0;

    const porAgente = new Map<string, { resueltos: number; total: number }>();
    for (const c of conversaciones) {
      if (!c.asignadoAId) continue;
      const cur = porAgente.get(c.asignadoAId) ?? { resueltos: 0, total: 0 };
      cur.total++;
      if (c.estado === "RESUELTO") cur.resueltos++;
      porAgente.set(c.asignadoAId, cur);
    }

    const ranking = agentes
      .map((a) => ({
        nombre: a.nombre,
        resueltos: porAgente.get(a.id)?.resueltos ?? 0,
        atenciones: porAgente.get(a.id)?.total ?? 0,
      }))
      .sort((a, b) => b.resueltos - a.resueltos);

    const clientesCount = new Map<string, number>();
    for (const c of conversaciones) {
      if (!c.clienteId) continue;
      clientesCount.set(c.clienteId, (clientesCount.get(c.clienteId) ?? 0) + 1);
    }
    const reincidentes = [...clientesCount.values()].filter((n) => n >= 3).length;

    const passwordChanges = acciones.find((a) => a.tipo === "WIFI_PASSWORD")?._count.id ?? 0;

    return NextResponse.json({
      periodoDias: dias,
      indicadores: {
        tiempoPromedioResolucionMin,
        resueltosRemoto: resueltos,
        escalados: escaladosCount || escalados,
        visitasEvitadas: resueltos,
        cambiosPassword: passwordChanges,
        configuraciones: acciones.reduce((s, a) => s + a._count.id, 0),
        clientesReincidentes: reincidentes,
        satisfaccionPromedio: calcPromedio(
          conversaciones.map((c) => c.satisfaccion).filter((s): s is number => s != null)
        ),
      },
      accionesPorTipo: acciones.map((a) => ({ tipo: a.tipo, total: a._count.id })),
      rankingAgentes: ranking,
    });
  } catch (err) {
    if (err instanceof HelpDeskAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

function calcPromedio(vals: number[]) {
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
