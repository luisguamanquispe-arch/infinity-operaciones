import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";

import { nombresTecnicosTicket, ticketIncludeTecnicos } from "@/lib/ticket-tecnicos";
import { sincronizarTicketsConOrdenCerrada } from "@/lib/ticket-cerrado";

export async function GET() {
  const session = await getFullSession();
  if (!session || !["SUPERVISOR", "ADMIN"].includes(session.rol)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await sincronizarTicketsConOrdenCerrada();

  const now = new Date();
  const hoy = new Date(now);
  hoy.setHours(0, 0, 0, 0);

  const [abiertos, cerrados, vencidos, tecnicos, ticketsRecientes] = await Promise.all([
    prisma.ticket.count({
      where: { estado: { in: ["PENDIENTE", "EN_PROCESO"] } },
    }),
    prisma.ticket.count({
      where: { estado: "CERRADO", updatedAt: { gte: hoy } },
    }),
    prisma.ticket.count({
      where: {
        estado: { in: ["PENDIENTE", "EN_PROCESO"] },
        slaVenceEn: { lt: now },
      },
    }),
    prisma.tecnico.findMany({
      include: { usuario: true },
    }),
    prisma.ticket.findMany({
      where: { estado: { in: ["PENDIENTE", "EN_PROCESO"] } },
      include: ticketIncludeTecnicos,
      orderBy: { prioridad: "asc" },
      take: 20,
    }),
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

  return NextResponse.json({
    kpis: {
      abiertos,
      cerrados,
      vencidos,
      tiempoPromedioMin: tiempoPromedio,
      primeraVisitaPct: primeraVisita,
    },
    tecnicos: tecnicos.map((t) => ({
      id: t.id,
      nombre: t.usuario.nombre,
      estado: t.estadoActual,
      lat: t.lat,
      lng: t.lng,
      telefono: t.telefono,
    })),
    tickets: ticketsRecientes.map((t) => ({
      id: t.id,
      codigo: t.codigo,
      prioridad: t.prioridad,
      estado: t.estado,
      cliente: t.cliente,
      tecnicosLabel: nombresTecnicosTicket(t),
    })),
  });
}
