import { prisma } from "@/lib/prisma";
import {
  ACTA_ITEMS,
  CLASE_MANT_LABELS,
  ESTADO_NOVEDAD_VEH_LABELS,
  ESTADO_VEHICULO_LABELS,
  GRAVEDAD_LABELS,
  ORIGEN_KM_LABELS,
  RESULTADO_INSPECCION_LABELS,
  SUBTITULO_REPORTE_PARQUE,
  TIPO_MANT_LABELS,
  TIPO_NOVEDAD_VEH_LABELS,
  TIPO_VEHICULO_LABELS,
  TITULO_REPORTE_PARQUE,
  type TipoReporteParque,
} from "./labels";
import { crearPdfCorporativo } from "./pdf-layout";
import {
  filasKilometrajeConDelta,
  formatEntero,
  formatFechaCorta,
  formatFechaHora,
  formatGalones,
  formatKm,
  formatUsd,
  sumar,
  textoCelda,
} from "./reporte-formato";
import {
  alertaMantenimientoFecha,
  alertaMantenimientoKm,
} from "./reglas";
import { dashboardParque } from "./servicio";
import type { OrigenKmVehiculo } from "@prisma/client";

function dataUrlToBuffer(dataUrl: string | null | undefined): Buffer | null {
  if (!dataUrl?.startsWith("data:image")) return null;
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  try {
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

function etiquetaOrigen(origen: string): string {
  return ORIGEN_KM_LABELS[origen as OrigenKmVehiculo] ?? origen;
}

function filtroVehiculo(vehiculoId?: string | null) {
  return vehiculoId ? { vehiculoId } : {};
}

async function nombreVehiculoFiltro(vehiculoId?: string | null) {
  if (!vehiculoId) return null;
  const v = await prisma.vehiculo.findUnique({
    where: { id: vehiculoId },
    select: { placa: true, marca: true, modelo: true },
  });
  return v ? `${v.placa} · ${v.marca} ${v.modelo}` : `Vehículo ${vehiculoId}`;
}

export async function generarPdfActaVehiculo(actaId: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const acta = await prisma.actaVehiculo.findUnique({
    where: { id: actaId },
    include: {
      vehiculo: true,
      firmas: true,
      asignacion: {
        include: {
          tecnico: { include: { usuario: { select: { nombre: true } } } },
          usuario: { select: { nombre: true } },
        },
      },
    },
  });
  if (!acta) throw new Error("Acta no encontrada");
  const titulo =
    acta.tipo === "ENTREGA" ? "Acta de entrega de vehículo" : "Acta de recepción de vehículo";
  const pdf = crearPdfCorporativo({
    titulo,
    subtitulo: "Control de entrega y recepción · Parque Automotor",
    filtros: [
      `Placa ${acta.vehiculo.placa}`,
      `${acta.vehiculo.marca} ${acta.vehiculo.modelo} ${acta.vehiculo.anio}`,
    ],
  });
  pdf.kpis([
    { label: "Kilometraje", value: formatKm(acta.kilometraje) },
    { label: "Combustible", value: `${acta.combustible} %` },
    { label: "Fecha", value: formatFechaHora(acta.createdAt) },
    { label: "Técnico", value: acta.asignacion.tecnico.usuario.nombre },
  ]);
  pdf.parrafo(`Operaciones: ${acta.asignacion.usuario.nombre}`);
  pdf.seccion("Checklist");
  pdf.tabla(
    [
      { label: "Ítem", width: 280 },
      { label: "Estado", width: 80, align: "center" },
    ],
    ACTA_ITEMS.map((item) => {
      const ok = Boolean((acta as unknown as Record<string, boolean>)[item.key]);
      return [item.label, ok ? "Conforme" : "No conforme"];
    })
  );
  if (acta.observaciones) {
    pdf.seccion("Observaciones");
    pdf.parrafo(acta.observaciones, "#0f172a");
  }
  pdf.seccion("Firmas");
  for (const f of acta.firmas) {
    pdf.ensureSpace(70);
    pdf.doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a").text(`Firma ${f.tipo}: ${f.nombre}`, pdf.marginX);
    const buf = dataUrlToBuffer(f.imagenData);
    if (buf) {
      try {
        pdf.doc.image(buf, { width: 140, height: 48 });
      } catch {
        /* firma opcional */
      }
    }
    pdf.doc.moveDown(0.6);
  }
  const buffer = await pdf.finalizar();
  return {
    buffer,
    filename: `acta-${acta.tipo.toLowerCase()}-${acta.vehiculo.placa}.pdf`,
  };
}

export async function generarPdfHojaVida(vehiculoId: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const v = await prisma.vehiculo.findUnique({
    where: { id: vehiculoId },
    include: {
      asignaciones: {
        orderBy: { fechaInicio: "desc" },
        include: {
          tecnico: { include: { usuario: { select: { nombre: true } } } },
        },
      },
      cargasCombustible: {
        where: { estadoRegistro: "ACTIVO" },
        orderBy: { fecha: "desc" },
      },
      lecturasKm: {
        where: { estadoRegistro: "ACTIVO" },
        orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      },
      mantenimientos: {
        where: { estadoRegistro: "ACTIVO" },
        orderBy: { fecha: "desc" },
      },
      novedades: { orderBy: { fecha: "desc" } },
      inspecciones: { orderBy: { fecha: "desc" } },
    },
  });
  if (!v) throw new Error("Vehículo no encontrado");

  const pdf = crearPdfCorporativo({
    titulo: `Hoja de vida · ${v.placa}`,
    subtitulo: "Expediente operativo del vehículo",
    filtros: [`${v.marca} ${v.modelo} (${v.anio})`, TIPO_VEHICULO_LABELS[v.tipo]],
    periodo: "Historial completo de registros activos",
  });
  pdf.kpis([
    { label: "Estado", value: ESTADO_VEHICULO_LABELS[v.estado] },
    { label: "Kilometraje actual", value: formatKm(v.kilometrajeActual) },
    { label: "Cargas de combustible", value: formatEntero(v.cargasCombustible.length) },
    { label: "Mantenimientos", value: formatEntero(v.mantenimientos.length) },
  ]);

  pdf.seccion("Asignaciones");
  pdf.tabla(
    [
      { label: "Inicio", width: 90 },
      { label: "Fin", width: 90 },
      { label: "Técnico", width: 140 },
      { label: "Km entrega", width: 70, align: "right" },
    ],
    v.asignaciones.map((a) => [
      formatFechaHora(a.fechaInicio),
      a.fechaFin ? formatFechaHora(a.fechaFin) : "Abierta",
      a.tecnico.usuario.nombre,
      formatKm(a.kilometrajeEntrega),
    ])
  );

  const kmFilas = filasKilometrajeConDelta(
    v.lecturasKm.map((l) => ({
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo,
      fecha: l.fecha,
      createdAt: l.createdAt,
      kilometraje: l.kilometraje,
      tipoLectura: l.tipoLectura,
      origen: etiquetaOrigen(l.origen),
      fuente: l.fuente,
      observacion: l.observacion,
    }))
  );
  pdf.seccion("Kilometraje (odómetro)");
  pdf.parrafo(
    "Fecha histórica = día del odómetro. Fecha de registro = momento en que se grabó. Las lecturas estimadas no se presentan como medición verificada."
  );
  pdf.tabla(
    [
      { label: "Fecha histórica", width: 70 },
      { label: "Registro", width: 90 },
      { label: "Km", width: 55, align: "right" },
      { label: "Δ km", width: 45, align: "right" },
      { label: "Tipo", width: 90 },
      { label: "Origen", width: 70 },
    ],
    kmFilas.map((f) => [
      f.fechaHistorica,
      f.fechaRegistro,
      formatKm(f.kilometraje),
      f.delta == null ? "—" : formatEntero(f.delta),
      f.tipoLectura,
      f.origen,
    ]),
    { resaltar: kmFilas.map((f) => f.estimada) }
  );

  pdf.seccion("Combustible (cargas)");
  pdf.parrafo("Importes y galones de cada carga. El km de la carga no reemplaza el historial de odómetro.");
  pdf.tabla(
    [
      { label: "Fecha", width: 90 },
      { label: "Estación", width: 110 },
      { label: "Galones", width: 55, align: "right" },
      { label: "Importe", width: 55, align: "right" },
      { label: "Km carga", width: 55, align: "right" },
      { label: "Alerta", width: 70 },
    ],
    v.cargasCombustible.map((c) => [
      formatFechaHora(c.fecha),
      c.estacion,
      formatGalones(c.galones),
      formatUsd(c.total),
      formatKm(c.kilometraje),
      c.consumoFueraPromedio ? "Fuera de promedio" : "—",
    ]),
    { resaltar: v.cargasCombustible.map((c) => c.consumoFueraPromedio) }
  );

  pdf.seccion("Mantenimiento");
  pdf.tabla(
    [
      { label: "Fecha", width: 80 },
      { label: "Clase", width: 70 },
      { label: "Tipo", width: 90 },
      { label: "Km", width: 55, align: "right" },
      { label: "Costo", width: 55, align: "right" },
      { label: "Próximo", width: 80 },
    ],
    v.mantenimientos.map((m) => [
      formatFechaCorta(m.fecha),
      CLASE_MANT_LABELS[m.clase],
      TIPO_MANT_LABELS[m.tipo],
      formatKm(m.kilometraje),
      formatUsd(m.costo),
      m.proximoFecha ? formatFechaCorta(m.proximoFecha) : m.proximoKm != null ? formatKm(m.proximoKm) : "—",
    ])
  );

  pdf.seccion("Novedades");
  pdf.tabla(
    [
      { label: "Fecha", width: 80 },
      { label: "Tipo", width: 80 },
      { label: "Estado", width: 80 },
      { label: "Descripción", width: 200 },
    ],
    v.novedades.map((n) => [
      formatFechaCorta(n.fecha),
      TIPO_NOVEDAD_VEH_LABELS[n.tipo],
      ESTADO_NOVEDAD_VEH_LABELS[n.estado],
      n.descripcion,
    ])
  );

  const buffer = await pdf.finalizar();
  return { buffer, filename: `hoja-vida-${v.placa}.pdf` };
}

export async function generarPdfReporteParque(
  tipo: TipoReporteParque,
  vehiculoId?: string | null
): Promise<{ buffer: Buffer; filename: string }> {
  const ident = await nombreVehiculoFiltro(vehiculoId);
  const filtros = ident ? [`Vehículo: ${ident}`] : ["Alcance: toda la flota"];
  const landscape = tipo === "combustible" || tipo === "kilometraje" || tipo === "costos";
  const pdf = crearPdfCorporativo({
    titulo: TITULO_REPORTE_PARQUE[tipo],
    subtitulo: SUBTITULO_REPORTE_PARQUE[tipo],
    filtros,
    periodo: "Registros activos disponibles",
    landscape,
  });
  const where = filtroVehiculo(vehiculoId);

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
        tipo: true,
      },
    });
    const inactivos = vehiculos.filter((v) => v.estado === "INACTIVO").length;
    pdf.kpis([
      { label: "Total vehículos", value: formatEntero(dash.total) },
      { label: "Operativos", value: formatEntero(dash.operativos) },
      { label: "Asignados", value: formatEntero(dash.asignados) },
      { label: "En mantenimiento", value: formatEntero(dash.mantenimiento) },
      { label: "Fuera de servicio", value: formatEntero(dash.fueraServicio) },
      { label: "Inactivos", value: formatEntero(inactivos) },
      { label: "Combustible del mes", value: formatUsd(dash.combustibleMes) },
      { label: "Km del mes (cargas)", value: formatKm(dash.kmMes) },
    ]);
    pdf.parrafo(
      "El kilometraje del mes proviene de km recorridos en cargas de combustible, no del historial de odómetro."
    );
    if (dash.alertas.length) {
      pdf.seccion("Alertas operativas");
      pdf.tabla(
        [
          { label: "Nivel", width: 50 },
          { label: "Placa", width: 60 },
          { label: "Mensaje", width: 320 },
        ],
        dash.alertas.map((a) => [a.nivel.toUpperCase(), a.placa, a.mensaje])
      );
    }
    pdf.seccion("Vehículos");
    pdf.tabla(
      [
        { label: "Placa", width: 60 },
        { label: "Vehículo", width: 140 },
        { label: "Tipo", width: 70 },
        { label: "Estado", width: 90 },
        { label: "Km actual", width: 70, align: "right" },
      ],
      vehiculos.map((v) => [
        v.placa,
        `${v.marca} ${v.modelo} ${v.anio}`,
        TIPO_VEHICULO_LABELS[v.tipo],
        ESTADO_VEHICULO_LABELS[v.estado],
        formatKm(v.kilometrajeActual),
      ])
    );
  } else if (tipo === "combustible") {
    const rows = await prisma.cargaCombustible.findMany({
      where: { ...where, estadoRegistro: "ACTIVO" },
      include: {
        vehiculo: { select: { placa: true, marca: true, modelo: true } },
        tecnico: { include: { usuario: { select: { nombre: true } } } },
      },
      orderBy: { fecha: "desc" },
    });
    const totalGal = sumar(rows.map((r) => r.galones));
    const totalUsd = sumar(rows.map((r) => r.total));
    const alertas = rows.filter((r) => r.consumoFueraPromedio).length;
    const porPlaca = new Map<string, { gal: number; usd: number }>();
    for (const r of rows) {
      const acc = porPlaca.get(r.vehiculo.placa) ?? { gal: 0, usd: 0 };
      acc.gal += r.galones;
      acc.usd += r.total;
      porPlaca.set(r.vehiculo.placa, acc);
    }
    pdf.kpis([
      { label: "Cargas", value: formatEntero(rows.length) },
      { label: "Galones", value: formatGalones(totalGal) },
      { label: "Importe", value: formatUsd(totalUsd) },
      { label: "Fuera de promedio", value: formatEntero(alertas) },
    ]);
    pdf.seccion("Totales por vehículo");
    pdf.tabla(
      [
        { label: "Placa", width: 70 },
        { label: "Galones", width: 80, align: "right" },
        { label: "Importe", width: 80, align: "right" },
      ],
      [...porPlaca.entries()].map(([placa, v]) => [
        placa,
        formatGalones(v.gal),
        formatUsd(v.usd),
      ])
    );
    pdf.seccion("Detalle de cargas");
    pdf.tabla(
      [
        { label: "Fecha", width: 85 },
        { label: "Placa", width: 50 },
        { label: "Estación", width: 90 },
        { label: "Gal.", width: 45, align: "right" },
        { label: "Importe", width: 55, align: "right" },
        { label: "Km carga", width: 55, align: "right" },
        { label: "Km rec.", width: 50, align: "right" },
        { label: "Alerta", width: 70 },
      ],
      rows.map((r) => [
        formatFechaHora(r.fecha),
        r.vehiculo.placa,
        r.estacion,
        formatGalones(r.galones),
        formatUsd(r.total),
        formatKm(r.kilometraje),
        r.kmRecorridos == null ? "—" : formatEntero(r.kmRecorridos),
        r.consumoFueraPromedio ? "Fuera de promedio" : "—",
      ]),
      { resaltar: rows.map((r) => r.consumoFueraPromedio) }
    );
  } else if (tipo === "kilometraje") {
    const rows = await prisma.lecturaKilometraje.findMany({
      where: { ...where, estadoRegistro: "ACTIVO" },
      include: {
        vehiculo: { select: { placa: true, marca: true, modelo: true, kilometrajeActual: true } },
        tecnico: { include: { usuario: { select: { nombre: true } } } },
      },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    });
    const ids = rows.map((r) => r.id);
    const auditorias = ids.length
      ? await prisma.vehiculoAuditoria.findMany({
          where: {
            entidad: "LecturaKilometraje",
            registroId: { in: ids },
            accion: { in: ["KM", "KM_REGULARIZACION"] },
          },
          select: {
            registroId: true,
            usuario: { select: { nombre: true } },
          },
        })
      : [];
    const usuarioPorLectura = new Map(
      auditorias.map((a) => [a.registroId, a.usuario?.nombre ?? null])
    );
    const filas = filasKilometrajeConDelta(
      rows.map((r) => ({
        placa: r.vehiculo.placa,
        marca: r.vehiculo.marca,
        modelo: r.vehiculo.modelo,
        fecha: r.fecha,
        createdAt: r.createdAt,
        kilometraje: r.kilometraje,
        tipoLectura: r.tipoLectura,
        origen: etiquetaOrigen(r.origen),
        fuente: r.fuente,
        observacion: r.observacion,
        responsable:
          r.tecnico?.usuario.nombre || usuarioPorLectura.get(r.id) || null,
      }))
    );
    const estimadas = filas.filter((f) => f.estimada).length;
    const deltas = filas.map((f) => f.delta).filter((n): n is number => n != null);
    pdf.kpis([
      { label: "Lecturas", value: formatEntero(filas.length) },
      { label: "Reales", value: formatEntero(filas.length - estimadas) },
      { label: "Estimadas", value: formatEntero(estimadas) },
      { label: "Km rec. válidos", value: formatKm(sumar(deltas)) },
    ]);
    pdf.parrafo(
      "Δ km se calcula solo entre lecturas consecutivas del mismo vehículo cuando el odómetro no desciende. Las estimadas aparecen destacadas y no se presentan como medición verificada."
    );
    pdf.tabla(
      [
        { label: "Placa", width: 48 },
        { label: "F. histórica", width: 62 },
        { label: "Registrada", width: 80 },
        { label: "Km", width: 50, align: "right" },
        { label: "Δ km", width: 40, align: "right" },
        { label: "Tipo", width: 85 },
        { label: "Fuente", width: 55 },
        { label: "Responsable", width: 70 },
      ],
      filas.map((f) => [
        f.placa,
        f.fechaHistorica,
        f.fechaRegistro,
        formatKm(f.kilometraje),
        f.delta == null ? "—" : formatEntero(f.delta),
        f.tipoLectura,
        textoCelda(f.fuente),
        f.responsable,
      ]),
      { resaltar: filas.map((f) => f.estimada) }
    );
  } else if (tipo === "mantenimiento") {
    const rows = await prisma.mantenimientoVehiculo.findMany({
      where: { ...where, estadoRegistro: "ACTIVO" },
      include: { vehiculo: { select: { placa: true, marca: true, modelo: true, kilometrajeActual: true } } },
      orderBy: { fecha: "desc" },
    });
    const total = sumar(rows.map((r) => r.costo));
    pdf.kpis([
      { label: "Intervenciones", value: formatEntero(rows.length) },
      { label: "Costo total", value: formatUsd(total) },
      {
        label: "Preventivos",
        value: formatEntero(rows.filter((r) => r.clase === "PREVENTIVO").length),
      },
      {
        label: "Correctivos",
        value: formatEntero(rows.filter((r) => r.clase === "CORRECTIVO").length),
      },
    ]);
    pdf.tabla(
      [
        { label: "Fecha", width: 70 },
        { label: "Placa", width: 50 },
        { label: "Clase", width: 65 },
        { label: "Servicio", width: 90 },
        { label: "Km", width: 50, align: "right" },
        { label: "Costo", width: 55, align: "right" },
        { label: "Próximo", width: 70 },
        { label: "Alerta", width: 55 },
      ],
      rows.map((r) => {
        const alerta =
          alertaMantenimientoKm({
            kmActual: r.vehiculo.kilometrajeActual,
            proximoKm: r.proximoKm,
          }) || alertaMantenimientoFecha(r.proximoFecha);
        return [
          formatFechaCorta(r.fecha),
          r.vehiculo.placa,
          CLASE_MANT_LABELS[r.clase],
          TIPO_MANT_LABELS[r.tipo],
          formatKm(r.kilometraje),
          formatUsd(r.costo),
          r.proximoFecha
            ? formatFechaCorta(r.proximoFecha)
            : r.proximoKm != null
              ? formatKm(r.proximoKm)
              : "—",
          alerta ? alerta.toUpperCase() : "—",
        ];
      })
    );
  } else if (tipo === "novedades") {
    const rows = await prisma.novedadVehiculo.findMany({
      where,
      include: { vehiculo: { select: { placa: true } } },
      orderBy: { fecha: "desc" },
    });
    const abiertas = rows.filter((r) =>
      ["REPORTADA", "EN_REVISION", "APROBADA", "EN_REPARACION"].includes(r.estado)
    ).length;
    pdf.kpis([
      { label: "Novedades", value: formatEntero(rows.length) },
      { label: "Pendientes", value: formatEntero(abiertas) },
      { label: "Resueltas", value: formatEntero(rows.filter((r) => r.estado === "RESUELTA").length) },
    ]);
    pdf.tabla(
      [
        { label: "Fecha", width: 70 },
        { label: "Placa", width: 50 },
        { label: "Tipo", width: 70 },
        { label: "Gravedad", width: 55 },
        { label: "Estado", width: 75 },
        { label: "Descripción", width: 180 },
      ],
      rows.map((r) => [
        formatFechaCorta(r.fecha),
        r.vehiculo.placa,
        TIPO_NOVEDAD_VEH_LABELS[r.tipo],
        GRAVEDAD_LABELS[r.gravedad],
        ESTADO_NOVEDAD_VEH_LABELS[r.estado],
        r.descripcion,
      ])
    );
  } else if (tipo === "asignaciones") {
    const rows = await prisma.asignacionVehiculo.findMany({
      where,
      include: {
        vehiculo: { select: { placa: true } },
        tecnico: { include: { usuario: { select: { nombre: true } } } },
      },
      orderBy: { fechaInicio: "desc" },
    });
    pdf.kpis([
      { label: "Asignaciones", value: formatEntero(rows.length) },
      { label: "Abiertas", value: formatEntero(rows.filter((r) => !r.fechaFin).length) },
    ]);
    pdf.tabla(
      [
        { label: "Placa", width: 55 },
        { label: "Técnico", width: 120 },
        { label: "Inicio", width: 90 },
        { label: "Fin", width: 90 },
        { label: "Km entrega", width: 70, align: "right" },
        { label: "Km recepción", width: 70, align: "right" },
      ],
      rows.map((r) => [
        r.vehiculo.placa,
        r.tecnico.usuario.nombre,
        formatFechaHora(r.fechaInicio),
        r.fechaFin ? formatFechaHora(r.fechaFin) : "Abierta",
        formatKm(r.kilometrajeEntrega),
        r.kilometrajeRecepcion == null ? "—" : formatKm(r.kilometrajeRecepcion),
      ])
    );
  } else if (tipo === "inspecciones") {
    const rows = await prisma.inspeccionVehiculo.findMany({
      where,
      include: {
        vehiculo: { select: { placa: true } },
        tecnico: { include: { usuario: { select: { nombre: true } } } },
      },
      orderBy: { fecha: "desc" },
    });
    pdf.kpis([
      { label: "Inspecciones", value: formatEntero(rows.length) },
      { label: "Aprobadas", value: formatEntero(rows.filter((r) => r.resultado === "APROBADO").length) },
      { label: "No apto", value: formatEntero(rows.filter((r) => r.resultado === "NO_APTO").length) },
    ]);
    pdf.tabla(
      [
        { label: "Fecha", width: 80 },
        { label: "Placa", width: 55 },
        { label: "Resultado", width: 80 },
        { label: "Km", width: 55, align: "right" },
        { label: "Comb. %", width: 50, align: "right" },
        { label: "Técnico", width: 120 },
      ],
      rows.map((r) => [
        formatFechaHora(r.fecha),
        r.vehiculo.placa,
        RESULTADO_INSPECCION_LABELS[r.resultado],
        formatKm(r.kilometraje),
        String(r.combustible),
        r.tecnico.usuario.nombre,
      ])
    );
  } else {
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
    const filas = Object.entries(by).sort((a, b) => b[1].c + b[1].m - (a[1].c + a[1].m));
    pdf.kpis([
      { label: "Combustible", value: formatUsd(sumar(cargas.map((c) => c.total))) },
      { label: "Mantenimiento", value: formatUsd(sumar(mants.map((m) => m.costo))) },
      {
        label: "Total",
        value: formatUsd(sumar(cargas.map((c) => c.total)) + sumar(mants.map((m) => m.costo))),
      },
    ]);
    pdf.tabla(
      [
        { label: "Placa", width: 70 },
        { label: "Combustible", width: 90, align: "right" },
        { label: "Mantenimiento", width: 90, align: "right" },
        { label: "Total", width: 90, align: "right" },
      ],
      filas.map(([placa, v]) => [
        placa,
        formatUsd(v.c),
        formatUsd(v.m),
        formatUsd(v.c + v.m),
      ])
    );
  }

  const buffer = await pdf.finalizar();
  return { buffer, filename: `reporte-${tipo}.pdf` };
}
