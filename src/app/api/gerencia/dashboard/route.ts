import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";
import { ESTADOS_ACTIVOS_TICKET } from "@/lib/ticket-gerencia";
import { tecnicoIdsFromTicket } from "@/lib/ticket-tecnicos";

export async function GET() {
  const session = await getFullSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    clientesActivos,
    ticketsAbiertos,
    instalacionesMes,
    reconexionesMes,
    retirosMes,
    ticketsCerrados,
    tecnicos,
  ] = await Promise.all([
    prisma.cliente.count({ where: { activo: true } }),
    prisma.ticket.count({ where: { estado: { in: [...ESTADOS_ACTIVOS_TICKET] } } }),
    prisma.ticket.count({
      where: { tipo: "INSTALACION", createdAt: { gte: inicioMes } },
    }),
    prisma.ticket.count({
      where: { tipo: "RECONEXION", createdAt: { gte: inicioMes } },
    }),
    prisma.ticket.count({
      where: { tipo: "RETIRO", createdAt: { gte: inicioMes } },
    }),
    prisma.ticket.findMany({
      where: { estado: "CERRADO", updatedAt: { gte: inicioMes } },
      include: {
        tecnico: { include: { usuario: true } },
        tecnicos: { include: { tecnico: { include: { usuario: true } } } },
        orden: { include: { cronometro: true } },
      },
    }),
    prisma.tecnico.findMany({ include: { usuario: true, tickets: true } }),
  ]);

  const rendimientoMap = new Map<
    string,
    { nombre: string; cerrados: number; tiempos: number[] }
  >();

  for (const t of ticketsCerrados) {
    const ids = tecnicoIdsFromTicket(t);
    const duracion = t.orden?.cronometro?.duracionSegundos;
    const targets =
      ids.length > 0
        ? ids.map((id) => {
            const row = t.tecnicos?.find((r) => r.tecnicoId === id);
            const nombre =
              row?.tecnico.usuario.nombre ??
              (t.tecnicoId === id ? t.tecnico?.usuario.nombre : null) ??
              "Técnico";
            return { id, nombre };
          })
        : [{ id: "sin-asignar", nombre: "Sin asignar" }];

    for (const { id, nombre } of targets) {
      if (!rendimientoMap.has(id)) {
        rendimientoMap.set(id, { nombre, cerrados: 0, tiempos: [] });
      }
      const entry = rendimientoMap.get(id)!;
      entry.cerrados++;
      if (duracion) entry.tiempos.push(duracion);
    }
  }

  const rendimiento = Array.from(rendimientoMap.values()).map((r) => ({
    tecnico: r.nombre,
    cerrados: r.cerrados,
    tiempoPromedioMin:
      r.tiempos.length > 0
        ? Math.round(r.tiempos.reduce((a, b) => a + b, 0) / r.tiempos.length / 60)
        : 0,
  }));

  const ticketsConSla = await prisma.ticket.findMany({
    where: { estado: "CERRADO", updatedAt: { gte: inicioMes } },
    include: { orden: { include: { cronometro: true } } },
  });

  let sla4h = 0;
  let sla8h = 0;
  let sla24h = 0;

  for (const t of ticketsConSla) {
    const dur = t.orden?.cronometro?.duracionSegundos || 0;
    const horas = dur / 3600;
    if (horas < 4) sla4h++;
    else if (horas < 8) sla8h++;
    else sla24h++;
  }

  const inventarioBajo = (await prisma.inventario.findMany()).filter(
    (i) => i.stock <= i.stockMin
  );

  return NextResponse.json({
    operacion: {
      clientesActivos,
      ticketsAbiertos,
      instalacionesMes,
      reconexionesMes,
      retirosMes,
    },
    rendimiento,
    sla: { menos4h: sla4h, menos8h: sla8h, mas24h: sla24h },
    inventarioBajo,
    totalTecnicos: tecnicos.length,
  });
}
