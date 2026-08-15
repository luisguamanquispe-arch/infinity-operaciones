import type { EstadoTicket, Prisma, TipoTrabajo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularDuracionCronometro } from "@/lib/tickets";
import { nombresTecnicosTicket } from "@/lib/ticket-tecnicos";
import { fotosParaReporte } from "@/lib/foto-image";
import { firmaParaReporte } from "@/lib/firma-image";
import { materialesParaReporte } from "@/lib/materiales-reporte";
import { gruposFotosPorTipo } from "@/lib/ticket-instalacion";
import { materialEsEquipoActivo, tipoInventarioEfectivo } from "@/lib/material-detalle";
import {
  construirResumenHistorial,
  esTipoHistorialCliente,
  normalizarMotivoHistorial,
  paginarLista,
  parseLimitPage,
  rangoFechaPreset,
  resultadoSoporteLabel,
  type TicketHistorialLite,
} from "@/lib/historial-soportes";

const ESTADOS: EstadoTicket[] = [
  "PENDIENTE",
  "LEIDO",
  "EN_PROCESO",
  "FINALIZADO",
  "CERRADO",
  "CANCELADO",
];

const TIPOS_HISTORIAL: TipoTrabajo[] = [
  "SOPORTE",
  "INSTALACION",
  "MIGRACION",
  "RECONEXION",
  "RETIRO",
  "CORTE",
];

const ticketLiteInclude = {
  tecnico: { include: { usuario: { select: { nombre: true } } } },
  tecnicos: {
    include: { tecnico: { include: { usuario: { select: { nombre: true } } } } },
    orderBy: { asignadoEn: "asc" as const },
  },
  orden: {
    select: {
      iniciadoEn: true,
      finalizadoEn: true,
      reportadoEn: true,
      servicioOk: true,
      cronometro: {
        select: { inicio: true, fin: true, pausasJson: true, duracionSegundos: true },
      },
      _count: { select: { fotografias: true, materiales: true } },
    },
  },
} satisfies Prisma.TicketInclude;

export type TicketHistorialRow = Prisma.TicketGetPayload<{ include: typeof ticketLiteInclude }>;

export function whereHistorialCliente(clienteId: string): Prisma.TicketWhereInput {
  return {
    clienteId,
    tipo: { not: "INFRAESTRUCTURA" },
  };
}

function finDelDia(d: Date): Date {
  const x = new Date(d);
  if (x.getHours() === 0 && x.getMinutes() === 0 && x.getSeconds() === 0) {
    x.setHours(23, 59, 59, 999);
  }
  return x;
}

export function parseFiltrosHistorial(search: URLSearchParams) {
  const { page, limit } = parseLimitPage(search);
  const q = (search.get("q") || search.get("codigo") || "").trim();
  const motivo = (search.get("motivo") || "").trim();
  const tecnico = (search.get("tecnico") || "").trim();
  const tecnicoId = (search.get("tecnicoId") || "").trim();
  const estadoRaw = (search.get("estado") || "").trim();
  const tipoRaw = (search.get("tipo") || "").trim();
  const rango = (search.get("rango") || "").trim();
  const desdeRaw = search.get("desde");
  const hastaRaw = search.get("hasta");
  const reincidencia = ["1", "true", "si"].includes((search.get("reincidencia") || "").toLowerCase());

  const estado = ESTADOS.includes(estadoRaw as EstadoTicket)
    ? (estadoRaw as EstadoTicket)
    : null;
  const tipo =
    TIPOS_HISTORIAL.includes(tipoRaw as TipoTrabajo) && esTipoHistorialCliente(tipoRaw)
      ? (tipoRaw as TipoTrabajo)
      : null;

  let desde: Date | null = null;
  let hasta: Date | null = null;
  if (rango === "custom") {
    if (desdeRaw) desde = new Date(desdeRaw);
    if (hastaRaw) hasta = finDelDia(new Date(hastaRaw));
  } else {
    const preset = rangoFechaPreset(rango || null);
    if (preset) {
      desde = preset.desde;
      hasta = preset.hasta;
    }
  }

  return { page, limit, q, motivo, tecnico, tecnicoId, estado, tipo, rango, desde, hasta, reincidencia };
}

export type FiltrosHistorial = ReturnType<typeof parseFiltrosHistorial>;

function duracionDeOrden(orden: TicketHistorialRow["orden"]): number {
  if (!orden?.cronometro) return 0;
  return calcularDuracionCronometro(
    orden.cronometro.inicio,
    orden.cronometro.fin,
    orden.cronometro.pausasJson
  );
}

export function ticketToLite(t: TicketHistorialRow): TicketHistorialLite {
  const nombres = nombresTecnicosTicket(t);
  return {
    id: t.id,
    codigo: t.codigo,
    tipo: t.tipo,
    estado: t.estado,
    motivo: t.motivo,
    createdAt: t.createdAt,
    duracionSegundos: duracionDeOrden(t.orden) || t.orden?.cronometro?.duracionSegundos || 0,
    creadoMs: t.createdAt.getTime(),
    cerradoMs: t.orden?.finalizadoEn?.getTime() ?? null,
    tecnicos: nombres && nombres !== "Sin asignar" ? nombres.split(",").map((n) => n.trim()) : [],
  };
}

export function mapTicketListado(t: TicketHistorialRow) {
  const duracionSegundos = duracionDeOrden(t.orden);
  return {
    id: t.id,
    codigo: t.codigo,
    tipo: t.tipo,
    estado: t.estado,
    estadoRevision: t.estadoRevision,
    prioridad: t.prioridad,
    motivo: t.motivo,
    createdAt: t.createdAt.toISOString(),
    iniciadoEn: t.orden?.iniciadoEn?.toISOString() ?? null,
    finalizadoEn: t.orden?.finalizadoEn?.toISOString() ?? null,
    asignadoEn: t.tecnicos[0]?.asignadoEn?.toISOString() ?? null,
    duracionSegundos,
    resultado: resultadoSoporteLabel({
      estado: t.estado,
      estadoRevision: t.estadoRevision,
      resultadoInfra: t.resultadoInfra,
      cierrePorJustificacion: t.cierrePorJustificacion,
      servicioOk: t.orden?.servicioOk,
    }),
    tecnicosLabel: nombresTecnicosTicket(t),
    fotosCount: t.orden?._count.fotografias ?? 0,
    materialesCount: t.orden?._count.materiales ?? 0,
  };
}

function ticketPasaFiltro(
  t: TicketHistorialRow,
  f: FiltrosHistorial,
  motivosRecurrentes: Set<string>
) {
  if (f.tipo && t.tipo !== f.tipo) return false;
  if (f.estado && t.estado !== f.estado) return false;
  if (f.desde && t.createdAt < f.desde) return false;
  if (f.hasta && t.createdAt > f.hasta) return false;
  if (f.tecnicoId) {
    const ids = [t.tecnicoId, ...t.tecnicos.map((x) => x.tecnicoId)].filter(Boolean);
    if (!ids.includes(f.tecnicoId)) return false;
  }
  if (f.tecnico) {
    const label = nombresTecnicosTicket(t).toUpperCase();
    if (!label.includes(f.tecnico.toUpperCase())) return false;
  }
  if (f.q) {
    const q = f.q.toUpperCase();
    const hay = t.codigo.toUpperCase().includes(q) || (t.motivo ?? "").toUpperCase().includes(q);
    if (!hay) return false;
  }
  if (f.motivo) {
    if (!normalizarMotivoHistorial(t.motivo).includes(normalizarMotivoHistorial(f.motivo))) {
      return false;
    }
  }
  if (f.reincidencia) {
    const key = normalizarMotivoHistorial(t.motivo);
    if (!key || !motivosRecurrentes.has(key)) return false;
  }
  return true;
}

export async function obtenerClienteHistorialONull(clienteId: string) {
  return prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      id: true,
      nombre: true,
      cedula: true,
      telefono: true,
      plan: true,
      direccion: true,
      sector: true,
      activo: true,
    },
  });
}

async function cargarTicketsLite(clienteId: string) {
  return prisma.ticket.findMany({
    where: whereHistorialCliente(clienteId),
    include: ticketLiteInclude,
    orderBy: { createdAt: "desc" },
  });
}

function motivosSetFromResumen(resumen: ReturnType<typeof construirResumenHistorial>) {
  return new Set(
    [
      ...resumen.alerta.motivosRecurrentes.map((m) => m.motivo),
      ...resumen.alerta.cantidadesMotivoVentana.map((m) => m.motivo),
    ].filter(Boolean)
  );
}

export async function obtenerHistorialSoportes(clienteId: string, search: URLSearchParams) {
  const cliente = await obtenerClienteHistorialONull(clienteId);
  if (!cliente) return null;

  const filtros = parseFiltrosHistorial(search);
  const tickets = await cargarTicketsLite(clienteId);
  const lites = tickets.map(ticketToLite);
  const resumen = construirResumenHistorial(lites);
  const motivosRecurrentes = motivosSetFromResumen(resumen);
  const filtrados = tickets.filter((t) => ticketPasaFiltro(t, filtros, motivosRecurrentes));
  const page = paginarLista(filtrados, filtros.page, filtros.limit);

  return {
    cliente,
    resumen,
    filtros: {
      page: page.page,
      limit: page.limit,
      q: filtros.q || undefined,
      motivo: filtros.motivo || undefined,
      tecnico: filtros.tecnico || undefined,
      tecnicoId: filtros.tecnicoId || undefined,
      estado: filtros.estado,
      tipo: filtros.tipo,
      rango: filtros.rango || undefined,
      reincidencia: filtros.reincidencia,
    },
    totalFiltrado: page.total,
    pages: page.pages,
    items: page.items.map(mapTicketListado),
  };
}

export async function obtenerHistorialSoportesParaPdf(
  clienteId: string,
  search: URLSearchParams,
  maxItems = 40
) {
  const cliente = await obtenerClienteHistorialONull(clienteId);
  if (!cliente) return null;

  const filtros = parseFiltrosHistorial(search);
  const tickets = await cargarTicketsLite(clienteId);
  const lites = tickets.map(ticketToLite);
  const resumen = construirResumenHistorial(lites);
  const motivosRecurrentes = motivosSetFromResumen(resumen);
  const filtrados = tickets.filter((t) => ticketPasaFiltro(t, filtros, motivosRecurrentes));
  const recortados = filtrados.slice(0, maxItems);

  return {
    cliente,
    resumen,
    filtros,
    totalFiltrado: filtrados.length,
    omitidos: Math.max(0, filtrados.length - recortados.length),
    items: recortados.map(mapTicketListado),
  };
}

export async function obtenerDetalleSoporteCliente(clienteId: string, ticketId: string) {
  const cliente = await obtenerClienteHistorialONull(clienteId);
  if (!cliente) return { error: "Cliente no encontrado" as const, status: 404 as const };

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      clienteId,
      tipo: { not: "INFRAESTRUCTURA" },
    },
    include: {
      tecnico: { include: { usuario: { select: { nombre: true } } } },
      tecnicos: {
        include: { tecnico: { include: { usuario: { select: { nombre: true } } } } },
        orderBy: { asignadoEn: "asc" },
      },
      orden: {
        include: {
          cronometro: true,
          medicion: true,
          fotografias: {
            orderBy: { tomadaEn: "asc" },
            select: {
              id: true,
              tipo: true,
              url: true,
              lat: true,
              lng: true,
              tomadaEn: true,
            },
          },
          firma: {
            select: {
              nombreCliente: true,
              cedula: true,
              imagenUrl: true,
              firmadoEn: true,
              lat: true,
              lng: true,
              aceptacionCondiciones: true,
              textoAceptacion: true,
              aceptadoEn: true,
            },
          },
          materiales: { include: { inventario: true } },
          reportadoPor: { include: { usuario: { select: { nombre: true } } } },
        },
      },
    },
  });

  if (!ticket) return { error: "Ticket no encontrado" as const, status: 404 as const };

  const orden = ticket.orden;
  const duracionSegundos = orden?.cronometro
    ? calcularDuracionCronometro(
        orden.cronometro.inicio,
        orden.cronometro.fin,
        orden.cronometro.pausasJson
      )
    : 0;

  const { antes, durante, final } = gruposFotosPorTipo(ticket.tipo);
  const fotos = fotosParaReporte(orden?.fotografias ?? []);
  const materiales = materialesParaReporte(orden?.materiales ?? []);
  const equipos = materiales.filter((m) => {
    const tipo = tipoInventarioEfectivo(m.inventario.tipo, m.inventario.nombre);
    return tipo === "EQUIPO" || materialEsEquipoActivo(m.inventario.nombre);
  });
  const insumos = materiales.filter((m) => !equipos.some((e) => e.id === m.id));

  const evaluacion = await prisma.evaluacionCliente.findFirst({
    where: { ticketCodigo: ticket.codigo },
    orderBy: { createdAt: "desc" },
    select: { calificacion: true, comentario: true, createdAt: true },
  });

  const asignadoEn = ticket.tecnicos[0]?.asignadoEn ?? null;

  return {
    cliente,
    ticket: {
      id: ticket.id,
      codigo: ticket.codigo,
      tipo: ticket.tipo,
      modalidadSoporte: ticket.modalidadSoporte,
      prioridad: ticket.prioridad,
      estado: ticket.estado,
      estadoRevision: ticket.estadoRevision,
      motivo: ticket.motivo,
      descripcion: ticket.descripcion,
      createdAt: ticket.createdAt.toISOString(),
      asignadoEn: asignadoEn?.toISOString() ?? null,
      tecnicosLabel: nombresTecnicosTicket(ticket),
      resultado: resultadoSoporteLabel({
        estado: ticket.estado,
        estadoRevision: ticket.estadoRevision,
        resultadoInfra: ticket.resultadoInfra,
        cierrePorJustificacion: ticket.cierrePorJustificacion,
        servicioOk: orden?.servicioOk,
      }),
      cierrePorJustificacion: ticket.cierrePorJustificacion,
    },
    atencion: {
      horaLlegada: orden?.iniciadoEn?.toISOString() ?? null,
      horaInicio: orden?.cronometro?.inicio?.toISOString() ?? orden?.iniciadoEn?.toISOString() ?? null,
      horaFin: orden?.finalizadoEn?.toISOString() ?? orden?.cronometro?.fin?.toISOString() ?? null,
      duracionSegundos,
      problemaReportado: ticket.motivo,
      diagnostico: ticket.diagnosticoInfra || ticket.descripcion,
      trabajoRealizado: orden?.resumenTrabajo || ticket.trabajoRealizadoInfra,
      observaciones: ticket.observacionesInfra,
      servicioOk: orden?.servicioOk ?? null,
    },
    materiales: insumos,
    equipos,
    evidencia: {
      antes: fotos.filter((f) => (antes as string[]).includes(f.tipo)),
      durante: fotos.filter((f) => (durante as string[]).includes(f.tipo)),
      despues: fotos.filter((f) => (final as string[]).includes(f.tipo)),
      otras: fotos.filter(
        (f) =>
          !(antes as string[]).includes(f.tipo) &&
          !(durante as string[]).includes(f.tipo) &&
          !(final as string[]).includes(f.tipo)
      ),
    },
    cierre: {
      reporteFinal: orden?.resumenTrabajo || ticket.trabajoRealizadoInfra,
      fechaCierre: orden?.finalizadoEn?.toISOString() ?? null,
      tecnicoCerro: orden?.reportadoPor?.usuario.nombre ?? null,
      observaciones: ticket.observacionesInfra,
      firma: firmaParaReporte(orden?.firma ?? null),
      calificacion: evaluacion,
    },
    medicion: orden?.medicion
      ? {
          rxDbm: orden.medicion.rxDbm,
          txDbm: orden.medicion.txDbm,
          pingMs: orden.medicion.pingMs,
          downloadMbps: orden.medicion.downloadMbps,
          uploadMbps: orden.medicion.uploadMbps,
        }
      : null,
  };
}
