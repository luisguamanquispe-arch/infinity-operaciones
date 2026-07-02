import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HelpDeskAuthError, requireHelpDeskSession } from "@/lib/help-desk/auth";

function handleError(err: unknown) {
  if (err instanceof HelpDeskAuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[HelpDesk dashboard]", err);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

export async function GET() {
  try {
    await requireHelpDeskSession();

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [
      agentesConectados,
      enCola,
      enAtencion,
      resueltosHoy,
      escaladosHoy,
      abiertos,
      conversaciones,
    ] = await Promise.all([
      prisma.hdSesionAgente.count({ where: { conectado: true } }),
      prisma.hdConversacion.count({ where: { estado: "EN_COLA" } }),
      prisma.hdConversacion.count({ where: { estado: "EN_ATENCION" } }),
      prisma.hdConversacion.count({
        where: { estado: "RESUELTO", cerradoEn: { gte: hoy } },
      }),
      prisma.hdConversacion.count({
        where: { estado: "ESCALADO", updatedAt: { gte: hoy } },
      }),
      prisma.hdConversacion.count({
        where: { estado: { in: ["EN_COLA", "EN_ATENCION", "EN_ESPERA_CLIENTE"] } },
      }),
      prisma.hdConversacion.findMany({
        where: { createdAt: { gte: hoy } },
        select: { createdAt: true, cerradoEn: true, estado: true, satisfaccion: true },
      }),
    ]);

    const cerradas = conversaciones.filter((c) => c.cerradoEn);
    const tiemposMs = cerradas.map(
      (c) => c.cerradoEn!.getTime() - c.createdAt.getTime()
    );
    const tiempoPromedioMin =
      tiemposMs.length > 0
        ? Math.round(tiemposMs.reduce((a, b) => a + b, 0) / tiemposMs.length / 60000)
        : 0;

    const satisfacciones = conversaciones
      .map((c) => c.satisfaccion)
      .filter((s): s is number => s != null);
    const satisfaccionPromedio =
      satisfacciones.length > 0
        ? Math.round(
            (satisfacciones.reduce((a, b) => a + b, 0) / satisfacciones.length) * 10
          ) / 10
        : null;

    return NextResponse.json({
      kpis: {
        agentesConectados,
        clientesEnEspera: enCola,
        conversacionesActivas: enAtencion,
        tiempoPromedioAtencionMin: tiempoPromedioMin,
        ticketsAbiertos: abiertos,
        escaladosHoy,
        resueltosRemotoHoy: resueltosHoy,
        slaEnRiesgo: enCola + enAtencion,
        satisfaccionPromedio,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
