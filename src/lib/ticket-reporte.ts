import { prisma } from "./prisma";
import { getOrCreateOrden } from "./tickets";
import { tecnicoIdsFromTicket } from "./ticket-tecnicos";

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

/** Multi-técnico: solo el primer técnico que escribe reclama el reporte y puede cerrar. */
export async function asegurarReportadorOrden(
  ticketId: string,
  tecnicoId: string
): Promise<ResultadoReporte> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });
  if (!ticket || !esTicketMultiTecnico(ticket)) {
    return { ok: true, esReportador: true };
  }

  if (["CERRADO", "FINALIZADO"].includes(ticket.estado)) {
    const orden = await prisma.ordenServicio.findUnique({
      where: { ticketId },
      select: { reportadoPorTecnicoId: true },
    });
    const quien = await nombreTecnico(orden?.reportadoPorTecnicoId);
    return {
      ok: false,
      status: 409,
      error: quien
        ? `Reporte ya registrado por ${quien}. El tiempo quedó registrado con ese técnico.`
        : "Reporte ya registrado en el sistema.",
      reportadoPorNombre: quien,
    };
  }

  const orden = await getOrCreateOrden(ticketId);

  if (!orden.reportadoPorTecnicoId) {
    const reclamado = await prisma.ordenServicio.updateMany({
      where: { id: orden.id, reportadoPorTecnicoId: null },
      data: { reportadoPorTecnicoId: tecnicoId, reportadoEn: new Date() },
    });
    if (reclamado.count > 0) {
      return { ok: true, esReportador: true };
    }
  }

  const actual = await prisma.ordenServicio.findUnique({
    where: { id: orden.id },
    select: { reportadoPorTecnicoId: true },
  });

  if (actual?.reportadoPorTecnicoId === tecnicoId) {
    return { ok: true, esReportador: true };
  }

  const quien = await nombreTecnico(actual?.reportadoPorTecnicoId);
  return {
    ok: false,
    status: 403,
    error: quien
      ? `El reporte y cierre lo realiza ${quien}. Solo ese técnico puede registrar y cerrar el ticket.`
      : "Otro técnico ya inició el reporte de este ticket.",
    reportadoPorNombre: quien,
  };
}

export async function infoReporteOrden(ticketId: string, tecnicoId: string | null) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });
  if (!ticket || !esTicketMultiTecnico(ticket)) {
    return {
      multiTecnico: false,
      puedeEditar: true,
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
      reportadoPor: { include: { usuario: { select: { nombre: true } } } },
    },
  });

  const reportadoPor = orden?.reportadoPorTecnicoId
    ? {
        id: orden.reportadoPorTecnicoId,
        nombre: orden.reportadoPor?.usuario.nombre ?? "Técnico",
      }
    : null;

  const cerrado = ["CERRADO", "FINALIZADO"].includes(ticket.estado);
  const esReportador = !orden?.reportadoPorTecnicoId || orden.reportadoPorTecnicoId === tecnicoId;
  const puedeEditar = esReportador && !cerrado;

  let mensaje: string | null = null;
  if (cerrado && reportadoPor) {
    mensaje = `Reporte registrado por ${reportadoPor.nombre}.`;
  } else if (!esReportador && reportadoPor) {
    mensaje = `El reporte y cierre lo realiza ${reportadoPor.nombre}. Verá el mismo registro al finalizar.`;
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
