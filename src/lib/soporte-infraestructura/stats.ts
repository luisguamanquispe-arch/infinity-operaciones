import { prisma } from "@/lib/prisma";
import { whereTicketActivoEnLista } from "@/lib/ticket-antiguedad";

export async function obtenerSiKpis() {
  const base = { tipo: "INFRAESTRUCTURA" as const };

  const [
    pendientes,
    asignadas,
    enProceso,
    finalizadas,
    criticas,
    tecnicosDisponibles,
    tecnicosEnCampo,
    ordenesCerradas,
  ] = await Promise.all([
    prisma.ticket.count({
      where: whereTicketActivoEnLista({ ...base, estado: "PENDIENTE" }),
    }),
    prisma.ticket.count({
      where: whereTicketActivoEnLista({ ...base, estado: "LEIDO" }),
    }),
    prisma.ticket.count({
      where: whereTicketActivoEnLista({ ...base, estado: "EN_PROCESO" }),
    }),
    prisma.ticket.count({
      where: { ...base, estado: { in: ["CERRADO", "FINALIZADO"] } },
    }),
    prisma.ticket.count({
      where: whereTicketActivoEnLista({ ...base, prioridad: "ALTA" }),
    }),
    prisma.tecnico.count({ where: { estadoActual: "DISPONIBLE", usuario: { activo: true } } }),
    prisma.tecnico.count({
      where: {
        estadoActual: "TRABAJANDO",
        usuario: { activo: true },
      },
    }),
    prisma.ordenServicio.findMany({
      where: {
        finalizadoEn: { not: null },
        ticket: base,
        cronometro: { isNot: null },
      },
      include: { cronometro: true },
      take: 200,
      orderBy: { finalizadoEn: "desc" },
    }),
  ]);

  const tiempos = ordenesCerradas
    .map((o) => o.cronometro?.duracionSegundos || 0)
    .filter((t) => t > 0);
  const tiempoPromedioMin =
    tiempos.length > 0
      ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length / 60)
      : null;

  return {
    pendientes,
    asignadas,
    enProceso,
    finalizadas,
    criticas,
    tiempoPromedioMin,
    tecnicosDisponibles,
    tecnicosEnCampo,
  };
}

export async function obtenerSiEstadisticas() {
  const hace12 = new Date();
  hace12.setMonth(hace12.getMonth() - 11);
  hace12.setDate(1);

  const tickets = await prisma.ticket.findMany({
    where: { tipo: "INFRAESTRUCTURA", createdAt: { gte: hace12 } },
    include: {
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      tecnicos: { include: { tecnico: { include: { usuario: { select: { nombre: true } } } } } },
      orden: {
        include: {
          materiales: true,
          cronometro: true,
        },
      },
    },
  });

  const porTecnico: Record<string, { nombre: string; n: number }> = {};
  const porTipo: Record<string, number> = {};
  const porSector: Record<string, number> = {};
  const materialesMap: Record<string, number> = {};
  let sumaTiempo = 0;
  let nTiempo = 0;
  let abiertas = 0;
  let finalizadas = 0;

  for (const t of tickets) {
    if (["CERRADO", "FINALIZADO"].includes(t.estado)) finalizadas += 1;
    else if (t.estado !== "CANCELADO") abiertas += 1;

    const tipoKey = t.siTipoTrabajo || t.motivoInfraestructura || "OTRO";
    porTipo[tipoKey] = (porTipo[tipoKey] || 0) + 1;

    const sector = t.sectorInfra || t.zonaInfra || "SIN SECTOR";
    porSector[sector] = (porSector[sector] || 0) + 1;

    if (t.tecnico) {
      const id = t.tecnico.id;
      porTecnico[id] = porTecnico[id] || { nombre: t.tecnico.usuario.nombre, n: 0 };
      porTecnico[id].n += 1;
    }

    const dur = t.orden?.cronometro?.duracionSegundos;
    if (dur && dur > 0) {
      sumaTiempo += dur;
      nTiempo += 1;
    }

    for (const m of t.orden?.materiales || []) {
      // material name resolved later if needed — use inventarioId count by quantity
      const key = m.inventarioId;
      materialesMap[key] = (materialesMap[key] || 0) + m.cantidad;
    }
  }

  const invIds = Object.keys(materialesMap);
  const invs =
    invIds.length > 0
      ? await prisma.inventario.findMany({
          where: { id: { in: invIds } },
          select: { id: true, nombre: true },
        })
      : [];
  const invNombre = Object.fromEntries(invs.map((i) => [i.id, i.nombre]));

  return {
    trabajosPorTecnico: Object.values(porTecnico)
      .sort((a, b) => b.n - a.n)
      .slice(0, 10)
      .map((v) => ({ nombre: v.nombre, total: v.n })),
    trabajosPorTipo: Object.entries(porTipo)
      .sort((a, b) => b[1] - a[1])
      .map(([tipo, total]) => ({ tipo, total })),
    sectoresIncidencia: Object.entries(porSector)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sector, total]) => ({ sector, total })),
    materialesMasUsados: Object.entries(materialesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, cantidad]) => ({
        material: invNombre[id] || id,
        cantidad,
      })),
    tiempoPromedioMin: nTiempo ? Math.round(sumaTiempo / nTiempo / 60) : null,
    ordenesAbiertas: abiertas,
    ordenesFinalizadas: finalizadas,
  };
}
