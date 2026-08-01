import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";

import { nombresTecnicosTicket, ticketIncludeTecnicos } from "@/lib/ticket-tecnicos";
import { whereTicketOperativamenteAbierto } from "@/lib/ticket-cerrado";
import { TIPO_NOVEDAD_LABELS } from "@/lib/novedad-ticket";
import { obtenerIrKpis } from "@/lib/infraestructura-red/stats";

export async function GET() {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // F4/E5: GET solo lectura — no sincronizar cierres en masa.

  const now = new Date();
  const hoy = new Date(now);
  hoy.setHours(0, 0, 0, 0);
  const abiertosWhere = whereTicketOperativamenteAbierto();

  const [abiertos, cerrados, vencidos, tecnicos, ticketsRecientes, infraestructura] =
    await Promise.all([
    prisma.ticket.count({
      where: abiertosWhere,
    }),
    prisma.ticket.count({
      where: { estado: "CERRADO", updatedAt: { gte: hoy } },
    }),
    prisma.ticket.count({
      where: whereTicketOperativamenteAbierto({ slaVenceEn: { lt: now } }),
    }),
    prisma.tecnico.findMany({
      include: { usuario: true },
    }),
    prisma.ticket.findMany({
      where: abiertosWhere,
      include: ticketIncludeTecnicos,
      orderBy: { prioridad: "asc" },
      take: 20,
    }),
    obtenerIrKpis(),
  ]);

  const ordenesCerradas = await prisma.ordenServicio.findMany({
    where: {
      finalizadoEn: { gte: hoy },
      cronometro: { isNot: null },
    },
    include: { cronometro: true },
  });

  const tiempos = ordenesCerradas
    .map((o) => o.cronometro?.duracionSegundos || 0)
    .filter((t) => t > 0);

  const tiempoPromedio =
    tiempos.length > 0
      ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length / 60)
      : 0;

  const totalCerradosMes = await prisma.ticket.count({
    where: {
      estado: "CERRADO",
      updatedAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
    },
  });

  const primeraVisita = totalCerradosMes > 0 ? Math.round((cerrados / totalCerradosMes) * 100) : 0;

  const ticketIds = ticketsRecientes.map((t) => t.id);
  const novedadesPendientes =
    ticketIds.length > 0
      ? await prisma.novedadTicket.findMany({
          where: { ticketId: { in: ticketIds }, estado: "PENDIENTE" },
          select: { ticketId: true, tipo: true },
        })
      : [];
  const novedadPorTicket = new Map(novedadesPendientes.map((n) => [n.ticketId, n.tipo]));

  return NextResponse.json({
    kpis: {
      abiertos,
      cerrados,
      vencidos,
      tiempoPromedioMin: tiempoPromedio,
      primeraVisitaPct: primeraVisita,
    },
    infraestructura,
    tecnicos: tecnicos.map((t) => ({
      id: t.id,
      nombre: t.usuario.nombre,
      estado: t.estadoActual,
      lat: t.lat,
      lng: t.lng,
      telefono: t.telefono,
    })),
    tickets: ticketsRecientes.map((t) => {
      const tipoNovedad = novedadPorTicket.get(t.id);
      return {
        id: t.id,
        codigo: t.codigo,
        prioridad: t.prioridad,
        estado: t.estado,
        cliente: t.cliente,
        tecnicosLabel: nombresTecnicosTicket(t),
        novedadPendiente: Boolean(tipoNovedad),
        novedadLabel: tipoNovedad ? TIPO_NOVEDAD_LABELS[tipoNovedad] : null,
      };
    }),
  });
}
