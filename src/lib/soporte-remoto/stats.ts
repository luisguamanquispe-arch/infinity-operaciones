import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SR_TIPO_SOPORTE_LABELS } from "./labels";

export async function obtenerEstadisticasSr(desde?: Date | null, hasta?: Date | null) {
  const fechaFilter: Prisma.SrTicketWhereInput =
    desde || hasta
      ? {
          fecha: {
            ...(desde ? { gte: desde } : {}),
            ...(hasta ? { lte: hasta } : {}),
          },
        }
      : {};

  const tickets = await prisma.srTicket.findMany({
    where: fechaFilter,
    select: {
      fecha: true,
      tiempoMinutos: true,
      tipoSoporte: true,
      resultado: true,
      estado: true,
      clienteNombre: true,
      clienteCodigo: true,
      operador: { select: { id: true, nombre: true } },
    },
  });

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  const porDiaMap = new Map<string, number>();
  const tipoMap = new Map<string, number>();
  const operadorMap = new Map<string, { nombre: string; count: number }>();
  const clienteMap = new Map<string, { nombre: string; codigo: string; count: number }>();
  let sumaTiempo = 0;
  let conTiempo = 0;
  let diarios = 0;
  let mensuales = 0;
  let resueltosRemoto = 0;
  let enviadosVisita = 0;

  for (const t of tickets) {
    const day = t.fecha.toISOString().slice(0, 10);
    porDiaMap.set(day, (porDiaMap.get(day) || 0) + 1);
    tipoMap.set(t.tipoSoporte, (tipoMap.get(t.tipoSoporte) || 0) + 1);

    const op = operadorMap.get(t.operador.id) || { nombre: t.operador.nombre, count: 0 };
    op.count += 1;
    operadorMap.set(t.operador.id, op);

    const ck = t.clienteCodigo;
    const cl = clienteMap.get(ck) || {
      nombre: t.clienteNombre,
      codigo: t.clienteCodigo,
      count: 0,
    };
    cl.count += 1;
    clienteMap.set(ck, cl);

    if (t.tiempoMinutos != null) {
      sumaTiempo += t.tiempoMinutos;
      conTiempo += 1;
    }

    if (t.fecha >= inicioDia) diarios += 1;
    if (t.fecha >= inicioMes) mensuales += 1;

    if (
      t.resultado === "SOLUCIONADO" ||
      t.resultado === "SOLUCIONADO_PARCIAL" ||
      (t.estado === "FINALIZADO" &&
        t.resultado !== "REQUIERE_VISITA" &&
        t.resultado !== "ESCALADO_SOPORTE_TECNICO")
    ) {
      resueltosRemoto += 1;
    }

    if (
      t.resultado === "REQUIERE_VISITA" ||
      t.resultado === "ESCALADO_SOPORTE_TECNICO" ||
      t.estado === "ESCALADO"
    ) {
      enviadosVisita += 1;
    }
  }

  return {
    total: tickets.length,
    diarios,
    mensuales,
    tiempoPromedioMin: conTiempo ? Math.round(sumaTiempo / conTiempo) : null,
    resueltosRemoto,
    enviadosVisita,
    porDia: [...porDiaMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, cantidad]) => ({ fecha, cantidad })),
    tiposFrecuentes: [...tipoMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tipo, cantidad]) => ({
        tipo,
        label: SR_TIPO_SOPORTE_LABELS[tipo as keyof typeof SR_TIPO_SOPORTE_LABELS] || tipo,
        cantidad,
      })),
    operadores: [...operadorMap.values()]
      .sort((a, b) => b.count - a.count)
      .map((o) => ({ nombre: o.nombre, cantidad: o.count })),
    clientesTop: [...clienteMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((c) => ({ nombre: c.nombre, codigo: c.codigo, cantidad: c.count })),
  };
}

export async function obtenerKpisDashboardSr() {
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);

  const [delDia, pendientes, finalizados, escalados, conTiempo] = await Promise.all([
    prisma.srTicket.count({ where: { fecha: { gte: inicioDia } } }),
    prisma.srTicket.count({ where: { estado: { in: ["PENDIENTE", "EN_PROCESO"] } } }),
    prisma.srTicket.count({
      where: { estado: "FINALIZADO", fecha: { gte: inicioDia } },
    }),
    prisma.srTicket.count({
      where: {
        OR: [
          { estado: "ESCALADO" },
          { resultado: { in: ["REQUIERE_VISITA", "ESCALADO_SOPORTE_TECNICO"] } },
        ],
        fecha: { gte: inicioDia },
      },
    }),
    prisma.srTicket.findMany({
      where: { fecha: { gte: inicioDia }, tiempoMinutos: { not: null } },
      select: { tiempoMinutos: true },
    }),
  ]);

  const suma = conTiempo.reduce((a, t) => a + (t.tiempoMinutos || 0), 0);
  return {
    soportesDelDia: delDia,
    pendientes,
    finalizadosHoy: finalizados,
    tiempoPromedioMin: conTiempo.length ? Math.round(suma / conTiempo.length) : null,
    escaladosVisitaHoy: escalados,
  };
}
