import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  CLASE_MANT_LABELS,
  ESTADO_NOVEDAD_VEH_LABELS,
  ESTADO_VEHICULO_LABELS,
  GRAVEDAD_LABELS,
  ORIGEN_KM_LABELS,
  RESULTADO_INSPECCION_LABELS,
  TIPO_MANT_LABELS,
  TIPO_NOVEDAD_VEH_LABELS,
  TITULO_REPORTE_PARQUE,
  type TipoReporteParque,
} from "./labels";
import {
  celdaTextoExcel,
  filasKilometrajeConDelta,
  formatFechaCorta,
  formatFechaHora,
  rangoAutofiltroExcel,
} from "./reporte-formato";
import { dashboardParque } from "./servicio";
import type { OrigenKmVehiculo } from "@prisma/client";

function libro(
  hojas: Array<{ nombre: string; filas: unknown[][]; anchos?: number[]; encabezado?: number }>
): Buffer {
  const wb = XLSX.utils.book_new();
  for (const h of hojas) {
    const ws = XLSX.utils.aoa_to_sheet(h.filas, { cellDates: false });
    const headerIdx = h.encabezado ?? 0;
    const nCols = Math.max(
      h.filas[headerIdx]?.length ?? 0,
      h.anchos?.length ?? 0,
      1
    );
    ws["!cols"] = (h.anchos?.length ? h.anchos : Array.from({ length: nCols }, () => 16)).map(
      (wch) => ({ wch })
    );
    const filtro = rangoAutofiltroExcel({
      columnas: nCols,
      filaEncabezado: headerIdx,
      totalFilas: h.filas.length,
    });
    if (filtro) ws["!autofilter"] = { ref: filtro };
    XLSX.utils.book_append_sheet(wb, ws, h.nombre.slice(0, 31));
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function generarExcelReporteParque(
  tipo: TipoReporteParque,
  vehiculoId?: string | null
): Promise<{ buffer: Buffer; filename: string }> {
  const where = vehiculoId ? { vehiculoId } : {};
  const meta = [
    ["INFINITY OPERACIONES"],
    ["Parque Automotor"],
    [TITULO_REPORTE_PARQUE[tipo]],
    ["Generado", formatFechaHora(new Date())],
    ["Filtro", vehiculoId ? `Vehículo ${vehiculoId}` : "Toda la flota"],
    [],
  ];

  if (tipo === "flota") {
    const dash = await dashboardParque();
    const vehiculos = await prisma.vehiculo.findMany({
      orderBy: { placa: "asc" },
      select: {
        placa: true,
        marca: true,
        modelo: true,
        anio: true,
        estado: true,
        kilometrajeActual: true,
      },
    });
    const inactivos = vehiculos.filter((v) => v.estado === "INACTIVO").length;
    const buffer = libro([
      {
        nombre: "Resumen",
        anchos: [28, 18],
        encabezado: meta.length,
        filas: [
          ...meta,
          ["Indicador", "Valor"],
          ["Total vehículos", dash.total],
          ["Operativos", dash.operativos],
          ["Asignados", dash.asignados],
          ["En mantenimiento", dash.mantenimiento],
          ["Fuera de servicio", dash.fueraServicio],
          ["Inactivos", inactivos],
          ["Combustible del mes (USD)", dash.combustibleMes],
          ["Km del mes (cargas de combustible)", dash.kmMes],
        ],
      },
      {
        nombre: "Vehiculos",
        anchos: [12, 16, 16, 10, 18, 14],
        filas: [
          ["Placa", "Marca", "Modelo", "Año", "Estado", "Km actual"],
          ...vehiculos.map((v) => [
            celdaTextoExcel(v.placa),
            v.marca,
            v.modelo,
            v.anio,
            ESTADO_VEHICULO_LABELS[v.estado],
            v.kilometrajeActual,
          ]),
        ],
      },
    ]);
    return { buffer, filename: "reporte-flota.xlsx" };
  }

  if (tipo === "kilometraje") {
    const rows = await prisma.lecturaKilometraje.findMany({
      where: { ...where, estadoRegistro: "ACTIVO" },
      include: {
        vehiculo: { select: { placa: true, marca: true, modelo: true } },
        tecnico: { include: { usuario: { select: { nombre: true } } } },
      },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    });
    const auditorias = rows.length
      ? await prisma.vehiculoAuditoria.findMany({
          where: {
            entidad: "LecturaKilometraje",
            registroId: { in: rows.map((r) => r.id) },
            accion: { in: ["KM", "KM_REGULARIZACION"] },
          },
          select: { registroId: true, usuario: { select: { nombre: true } } },
        })
      : [];
    const usuarioPorLectura = new Map(auditorias.map((a) => [a.registroId, a.usuario?.nombre ?? null]));
    const filas = filasKilometrajeConDelta(
      rows.map((r) => ({
        placa: r.vehiculo.placa,
        marca: r.vehiculo.marca,
        modelo: r.vehiculo.modelo,
        fecha: r.fecha,
        createdAt: r.createdAt,
        kilometraje: r.kilometraje,
        tipoLectura: r.tipoLectura,
        origen: ORIGEN_KM_LABELS[r.origen as OrigenKmVehiculo] ?? r.origen,
        fuente: r.fuente,
        observacion: r.observacion,
        responsable: r.tecnico?.usuario.nombre || usuarioPorLectura.get(r.id) || null,
      }))
    );
    const buffer = libro([
      {
        nombre: "Kilometraje",
        anchos: [12, 22, 14, 20, 12, 10, 28, 14, 16, 24, 28],
        encabezado: meta.length,
        filas: [
          ...meta,
          [
            "Placa",
            "Vehículo",
            "Fecha histórica",
            "Fecha de registro",
            "Kilometraje",
            "Delta km",
            "Tipo de lectura",
            "Origen",
            "Fuente",
            "Responsable",
            "Observación",
          ],
          ...filas.map((f) => [
            celdaTextoExcel(f.placa),
            f.vehiculo,
            f.fechaHistorica,
            f.fechaRegistro,
            f.kilometraje,
            f.delta ?? "",
            f.tipoLectura,
            f.origen,
            f.fuente === "—" ? "" : f.fuente,
            f.responsable === "—" ? "" : f.responsable,
            f.observacion === "—" ? "" : f.observacion,
          ]),
        ],
      },
    ]);
    return { buffer, filename: "reporte-kilometraje.xlsx" };
  }

  if (tipo === "combustible") {
    const rows = await prisma.cargaCombustible.findMany({
      where: { ...where, estadoRegistro: "ACTIVO" },
      include: { vehiculo: { select: { placa: true } } },
      orderBy: { fecha: "desc" },
    });
    const buffer = libro([
      {
        nombre: "Combustible",
        anchos: [12, 20, 22, 12, 12, 12, 12, 12, 14, 22],
        encabezado: meta.length,
        filas: [
          ...meta,
          [
            "Placa",
            "Fecha",
            "Estación",
            "Galones",
            "Precio/gal",
            "Importe USD",
            "Km de la carga",
            "Km recorridos (carga)",
            "Km/gal",
            "Alerta",
          ],
          ...rows.map((r) => [
            celdaTextoExcel(r.vehiculo.placa),
            formatFechaHora(r.fecha),
            r.estacion,
            r.galones,
            r.precioPorGalon,
            r.total,
            r.kilometraje,
            r.kmRecorridos ?? "",
            r.kmPorGalon ?? "",
            r.consumoFueraPromedio ? "Consumo fuera del promedio" : "",
          ]),
        ],
      },
    ]);
    return { buffer, filename: "reporte-combustible.xlsx" };
  }

  if (tipo === "mantenimiento") {
    const rows = await prisma.mantenimientoVehiculo.findMany({
      where: { ...where, estadoRegistro: "ACTIVO" },
      include: { vehiculo: { select: { placa: true } } },
      orderBy: { fecha: "desc" },
    });
    const buffer = libro([
      {
        nombre: "Mantenimiento",
        anchos: [12, 14, 14, 22, 12, 12, 18, 14, 28],
        encabezado: meta.length,
        filas: [
          ...meta,
          [
            "Placa",
            "Fecha",
            "Clase",
            "Tipo de servicio",
            "Km",
            "Costo USD",
            "Próxima fecha",
            "Próximo km",
            "Proveedor",
          ],
          ...rows.map((r) => [
            celdaTextoExcel(r.vehiculo.placa),
            formatFechaCorta(r.fecha),
            CLASE_MANT_LABELS[r.clase],
            TIPO_MANT_LABELS[r.tipo],
            r.kilometraje,
            r.costo,
            r.proximoFecha ? formatFechaCorta(r.proximoFecha) : "",
            r.proximoKm ?? "",
            r.proveedor ?? "",
          ]),
        ],
      },
    ]);
    return { buffer, filename: "reporte-mantenimiento.xlsx" };
  }

  if (tipo === "novedades") {
    const rows = await prisma.novedadVehiculo.findMany({
      where,
      include: { vehiculo: { select: { placa: true } } },
      orderBy: { fecha: "desc" },
    });
    const buffer = libro([
      {
        nombre: "Novedades",
        anchos: [12, 14, 16, 12, 16, 12, 40],
        encabezado: meta.length,
        filas: [
          ...meta,
          ["Placa", "Fecha", "Tipo", "Gravedad", "Estado", "Km", "Descripción"],
          ...rows.map((r) => [
            celdaTextoExcel(r.vehiculo.placa),
            formatFechaCorta(r.fecha),
            TIPO_NOVEDAD_VEH_LABELS[r.tipo],
            GRAVEDAD_LABELS[r.gravedad],
            ESTADO_NOVEDAD_VEH_LABELS[r.estado],
            r.kilometraje,
            r.descripcion,
          ]),
        ],
      },
    ]);
    return { buffer, filename: "reporte-novedades.xlsx" };
  }

  if (tipo === "asignaciones") {
    const rows = await prisma.asignacionVehiculo.findMany({
      where,
      include: {
        vehiculo: { select: { placa: true } },
        tecnico: { include: { usuario: { select: { nombre: true } } } },
      },
      orderBy: { fechaInicio: "desc" },
    });
    const buffer = libro([
      {
        nombre: "Asignaciones",
        anchos: [12, 22, 20, 20, 12, 14],
        encabezado: meta.length,
        filas: [
          ...meta,
          ["Placa", "Técnico", "Inicio", "Fin", "Km entrega", "Km recepción"],
          ...rows.map((r) => [
            celdaTextoExcel(r.vehiculo.placa),
            r.tecnico.usuario.nombre,
            formatFechaHora(r.fechaInicio),
            r.fechaFin ? formatFechaHora(r.fechaFin) : "Abierta",
            r.kilometrajeEntrega,
            r.kilometrajeRecepcion ?? "",
          ]),
        ],
      },
    ]);
    return { buffer, filename: "reporte-asignaciones.xlsx" };
  }

  if (tipo === "inspecciones") {
    const rows = await prisma.inspeccionVehiculo.findMany({
      where,
      include: {
        vehiculo: { select: { placa: true } },
        tecnico: { include: { usuario: { select: { nombre: true } } } },
      },
      orderBy: { fecha: "desc" },
    });
    const buffer = libro([
      {
        nombre: "Inspecciones",
        anchos: [12, 20, 16, 12, 12, 22],
        encabezado: meta.length,
        filas: [
          ...meta,
          ["Placa", "Fecha", "Resultado", "Km", "Combustible %", "Técnico"],
          ...rows.map((r) => [
            celdaTextoExcel(r.vehiculo.placa),
            formatFechaHora(r.fecha),
            RESULTADO_INSPECCION_LABELS[r.resultado],
            r.kilometraje,
            r.combustible,
            r.tecnico.usuario.nombre,
          ]),
        ],
      },
    ]);
    return { buffer, filename: "reporte-inspecciones.xlsx" };
  }

  const cargas = await prisma.cargaCombustible.findMany({
    where: { ...where, estadoRegistro: "ACTIVO" },
    include: { vehiculo: { select: { placa: true } } },
  });
  const mants = await prisma.mantenimientoVehiculo.findMany({
    where: { ...where, estadoRegistro: "ACTIVO" },
    include: { vehiculo: { select: { placa: true } } },
  });
  const by: Record<string, { c: number; m: number }> = {};
  for (const c of cargas) {
    by[c.vehiculo.placa] ??= { c: 0, m: 0 };
    by[c.vehiculo.placa].c += c.total;
  }
  for (const m of mants) {
    by[m.vehiculo.placa] ??= { c: 0, m: 0 };
    by[m.vehiculo.placa].m += m.costo;
  }
  const buffer = libro([
    {
      nombre: "Costos",
      anchos: [12, 16, 16, 14],
      encabezado: meta.length,
      filas: [
        ...meta,
        ["Placa", "Combustible USD", "Mantenimiento USD", "Total USD"],
        ...Object.entries(by).map(([placa, v]) => [
          celdaTextoExcel(placa),
          Math.round(v.c * 100) / 100,
          Math.round(v.m * 100) / 100,
          Math.round((v.c + v.m) * 100) / 100,
        ]),
      ],
    },
  ]);
  return { buffer, filename: "reporte-costos.xlsx" };
}
