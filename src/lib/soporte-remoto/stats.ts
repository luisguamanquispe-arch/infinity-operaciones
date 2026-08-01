import type { Prisma, SrResultado, SrTipoSoporte } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SR_RESULTADO_LABELS, SR_TIPO_SOPORTE_LABELS } from "./labels";

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
      clienteNombre: true,
      clienteCodigo: true,
      operador: { select: { id: true, nombre: true } },
    },
  });

  const porDiaMap = new Map<string, number>();
  const tipoMap = new Map<SrTipoSoporte, number>();
  const operadorMap = new Map<string, { nombre: string; count: number }>();
  const clienteMap = new Map<string, { nombre: string; codigo: string; count: number }>();
  let sumaTiempo = 0;
  let conTiempo = 0;
  let escaladosVisita = 0;

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

    const r = t.resultado as SrResultado | null;
    if (r === "REQUIERE_VISITA" || r === "ESCALADO_SOPORTE_TECNICO") {
      escaladosVisita += 1;
    }
  }

  const porDia = [...porDiaMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, cantidad]) => ({ fecha, cantidad }));

  const tiposFrecuentes = [...tipoMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tipo, cantidad]) => ({
      tipo,
      label: SR_TIPO_SOPORTE_LABELS[tipo],
      cantidad,
    }));

  const operadores = [...operadorMap.values()]
    .sort((a, b) => b.count - a.count)
    .map((o) => ({ nombre: o.nombre, cantidad: o.count }));

  const clientesTop = [...clienteMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((c) => ({ nombre: c.nombre, codigo: c.codigo, cantidad: c.count }));

  return {
    total: tickets.length,
    tiempoPromedioMin: conTiempo ? Math.round(sumaTiempo / conTiempo) : null,
    porDia,
    tiposFrecuentes,
    operadores,
    clientesTop,
    escaladosVisita,
    resultadosEscalados: {
      requiereVisita: tickets.filter((t) => t.resultado === "REQUIERE_VISITA").length,
      escaladoTecnico: tickets.filter((t) => t.resultado === "ESCALADO_SOPORTE_TECNICO").length,
      labels: {
        REQUIERE_VISITA: SR_RESULTADO_LABELS.REQUIERE_VISITA,
        ESCALADO_SOPORTE_TECNICO: SR_RESULTADO_LABELS.ESCALADO_SOPORTE_TECNICO,
      },
    },
  };
}
