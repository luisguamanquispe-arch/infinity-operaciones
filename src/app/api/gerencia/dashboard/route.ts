import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFullSession } from "@/lib/auth";

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
    prisma.ticket.count({ where: { estado: { in: ["PENDIENTE", "EN_PROCESO"] } } }),
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
    const key = t.tecnicoId || "sin-asignar";
    const nombre = t.tecnico?.usuario.nombre || "Sin asignar";
    if (!rendimientoMap.has(key)) {
      rendimientoMap.set(key, { nombre, cerrados: 0, tiempos: [] });
    }
    const entry = rendimientoMap.get(key)!;
    entry.cerrados++;
    if (t.orden?.cronometro?.duracionSegundos) {
      entry.tiempos.push(t.orden.cronometro.duracionSegundos);
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
