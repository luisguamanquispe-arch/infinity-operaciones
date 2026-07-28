import { prisma } from "./prisma";
import { getOrCreateOrden } from "./tickets";
import { tecnicoAsignadoAlTicket, tecnicoIdsFromTicket } from "./ticket-tecnicos";
import { ticketEstaCerrado, ticketPermiteEdicion } from "./ticket-cerrado";

export function esTicketMultiTecnico(ticket: {
  tecnicoId: string | null;
  tecnicos?: { tecnicoId: string }[];
}): boolean {
  return tecnicoIdsFromTicket(ticket).length > 1;
}

async function nombreTecnico(tecnicoId: string | null | undefined): Promise<string | null> {
  if (!tecnicoId) return null;
  const t = await prisma.tecnico.findUnique({
    where: { id: tecnicoId },
    include: { usuario: { select: { nombre: true } } },
  });
  return t?.usuario.nombre ?? null;
}

export type ResultadoReporte =
  | { ok: true; esReportador: boolean }
  | { ok: false; status: number; error: string; reportadoPorNombre: string | null };

/**
 * F5/E4 Opción A: cualquier técnico asignado puede colaborar (abrir, cronómetro,
 * fotos, mediciones) mientras la orden no esté cerrada.
 * Ya no reclama reportadoPorTecnicoId en la primera escritura.
 */
export async function asegurarColaboracionOrden(
  ticketId: string,
  tecnicoId: string
): Promise<ResultadoReporte> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      tecnicos: { select: { tecnicoId: true } },
      orden: { select: { finalizadoEn: true, reportadoPorTecnicoId: true } },
    },
  });

  if (!ticket || !tecnicoAsignadoAlTicket(ticket, tecnicoId)) {
    return {
      ok: false,
      status: 403,
      error: "Este ticket no está asignado a usted",
      reportadoPorNombre: null,
    };
  }

  if (ticketEstaCerrado(ticket, ticket.orden)) {
    const quien = await nombreTecnico(ticket.orden?.reportadoPorTecnicoId);
    return {
      ok: false,
      status: 409,
      error: quien
        ? `Reporte ya registrado por ${quien}. La orden está cerrada.`
        : "La orden ya está cerrada.",
      reportadoPorNombre: quien,
    };
  }

  const esReportador =
    !ticket.orden?.reportadoPorTecnicoId ||
    ticket.orden.reportadoPorTecnicoId === tecnicoId;

  return { ok: true, esReportador };
}

/**
 * @deprecated Preferir asegurarColaboracionOrden (F5/E4).
 * Conservado como alias para no romper imports residuales.
 */
export async function asegurarReportadorOrden(
  ticketId: string,
  tecnicoId: string
): Promise<ResultadoReporte> {
  return asegurarColaboracionOrden(ticketId, tecnicoId);
}

/** Marca quién cerró / reportó si aún no hay reportador (informativo). */
export async function registrarReportadorSiVacio(
  ticketId: string,
  tecnicoId: string
): Promise<void> {
  const orden = await getOrCreateOrden(ticketId);
  if (orden.reportadoPorTecnicoId) return;
  await prisma.ordenServicio.updateMany({
    where: { id: orden.id, reportadoPorTecnicoId: null },
    data: { reportadoPorTecnicoId: tecnicoId, reportadoEn: new Date() },
  });
}

export async function infoReporteOrden(ticketId: string, tecnicoId: string | null) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });
  if (!ticket || !esTicketMultiTecnico(ticket)) {
    const orden = await prisma.ordenServicio.findUnique({
      where: { ticketId },
      select: { finalizadoEn: true },
    });
    const puedeEditar = ticket ? ticketPermiteEdicion(ticket, orden) : true;
    return {
      multiTecnico: false,
      puedeEditar,
      esReportador: true,
      reportadoPor: null as { id: string; nombre: string } | null,
      reportadoEn: null as string | null,
      mensaje: null as string | null,
    };
  }

  const orden = await prisma.ordenServicio.findUnique({
    where: { ticketId },
    select: {
      reportadoPorTecnicoId: true,
      reportadoEn: true,
      finalizadoEn: true,
      reportadoPor: { include: { usuario: { select: { nombre: true } } } },
    },
  });

  const reportadoPor = orden?.reportadoPorTecnicoId
    ? {
        id: orden.reportadoPorTecnicoId,
        nombre: orden.reportadoPor?.usuario.nombre ?? "Técnico",
      }
    : null;

  const cerrado = ticketEstaCerrado(ticket, orden);
  const asignado =
    !!tecnicoId && tecnicoAsignadoAlTicket(ticket, tecnicoId);
  const esReportador =
    !orden?.reportadoPorTecnicoId || orden.reportadoPorTecnicoId === tecnicoId;
  // F5/E4: todos los asignados pueden editar mientras la orden esté abierta
  const puedeEditar = asignado && ticketPermiteEdicion(ticket, orden);

  let mensaje: string | null = null;
  if (cerrado && reportadoPor) {
    mensaje = `Reporte registrado por ${reportadoPor.nombre}.`;
  } else if (reportadoPor) {
    mensaje = `Ticket con varios técnicos. Reportador: ${reportadoPor.nombre}. Todos los asignados pueden trabajar y cerrar.`;
  } else {
    mensaje =
      "Ticket con varios técnicos. Todos los asignados pueden trabajar; quien cierre queda como reportador.";
  }

  return {
    multiTecnico: true,
    puedeEditar,
    esReportador,
    reportadoPor,
    reportadoEn: orden?.reportadoEn?.toISOString() ?? null,
    mensaje,
  };
}
