import { prisma } from "@/lib/prisma";
import {
  IR_TIPOS_CORRECTIVOS,
  IR_TIPOS_PREVENTIVOS,
} from "./labels";

export type IrKpis = {
  abiertos: number;
  enProceso: number;
  finalizados: number;
  preventivos: number;
  correctivos: number;
  kmRed: number;
  clientesAfectados: number;
  tiempoPromedioMin: number | null;
};

export async function obtenerIrKpis(whereExtra?: {
  tecnicoId?: string;
}): Promise<IrKpis> {
  const base = whereExtra?.tecnicoId ? { tecnicoId: whereExtra.tecnicoId } : {};

  const [
    abiertos,
    enProceso,
    finalizados,
    preventivos,
    correctivos,
    agg,
  ] = await Promise.all([
    prisma.irReporte.count({
      where: { ...base, estado: { in: ["PENDIENTE", "ASIGNADO"] } },
    }),
    prisma.irReporte.count({ where: { ...base, estado: "EN_PROCESO" } }),
    prisma.irReporte.count({ where: { ...base, estado: "FINALIZADO" } }),
    prisma.irReporte.count({
      where: { ...base, tipoTrabajo: { in: IR_TIPOS_PREVENTIVOS } },
    }),
    prisma.irReporte.count({
      where: { ...base, tipoTrabajo: { in: IR_TIPOS_CORRECTIVOS } },
    }),
    prisma.irReporte.aggregate({
      where: base,
      _sum: { kmRedIntervenida: true, clientesAfectadosN: true },
      _avg: { tiempoMinutos: true },
    }),
  ]);

  return {
    abiertos,
    enProceso,
    finalizados,
    preventivos,
    correctivos,
    kmRed: Number(agg._sum.kmRedIntervenida || 0),
    clientesAfectados: Number(agg._sum.clientesAfectadosN || 0),
    tiempoPromedioMin:
      agg._avg.tiempoMinutos != null ? Math.round(agg._avg.tiempoMinutos) : null,
  };
}

export async function obtenerIrEstadisticas() {
  const ahora = new Date();
  const hace12 = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1);

  const reportes = await prisma.irReporte.findMany({
    where: { fecha: { gte: hace12 } },
    select: {
      fecha: true,
      tipoTrabajo: true,
      sector: true,
      tecnicoId: true,
      tiempoMinutos: true,
      materiales: { select: { material: true, cantidad: true } },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
  });

  const porMes: Record<string, number> = {};
  const cortesPorSector: Record<string, number> = {};
  const materialesMap: Record<string, number> = {};
  const tecnicosMap: Record<string, { nombre: string; n: number }> = {};
  const sectoresMap: Record<string, number> = {};
  let preventivos = 0;
  let correctivos = 0;
  let sumaTiempo = 0;
  let nTiempo = 0;

  for (const r of reportes) {
    const key = `${r.fecha.getFullYear()}-${String(r.fecha.getMonth() + 1).padStart(2, "0")}`;
    porMes[key] = (porMes[key] || 0) + 1;

    if (IR_TIPOS_PREVENTIVOS.includes(r.tipoTrabajo)) preventivos += 1;
    if (IR_TIPOS_CORRECTIVOS.includes(r.tipoTrabajo)) correctivos += 1;

    if (r.tipoTrabajo === "CORTE_FIBRA") {
      cortesPorSector[r.sector] = (cortesPorSector[r.sector] || 0) + 1;
    }
    sectoresMap[r.sector] = (sectoresMap[r.sector] || 0) + 1;

    const tn = tecnicosMap[r.tecnicoId] || {
      nombre: r.tecnico.usuario.nombre,
      n: 0,
    };
    tn.n += 1;
    tecnicosMap[r.tecnicoId] = tn;

    if (r.tiempoMinutos != null) {
      sumaTiempo += r.tiempoMinutos;
      nTiempo += 1;
    }

    for (const m of r.materiales) {
      materialesMap[m.material] = (materialesMap[m.material] || 0) + m.cantidad;
    }
  }

  const top = <T extends { n: number }>(entries: [string, T][], limit = 8) =>
    entries.sort((a, b) => b[1].n - a[1].n).slice(0, limit);

  return {
    trabajosPorMes: Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, total]) => ({ mes, total })),
    preventivos,
    correctivos,
    cortesPorSector: Object.entries(cortesPorSector)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sector, total]) => ({ sector, total })),
    materialesMasUsados: Object.entries(materialesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([material, cantidad]) => ({ material, cantidad })),
    tecnicosMasActivos: top(
      Object.entries(tecnicosMap).map(([id, v]) => [id, v] as [string, { nombre: string; n: number }])
    ).map(([, v]) => ({ nombre: v.nombre, total: v.n })),
    tiempoPromedioMin: nTiempo ? Math.round(sumaTiempo / nTiempo) : null,
    sectoresIncidencia: Object.entries(sectoresMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sector, total]) => ({ sector, total })),
  };
}
