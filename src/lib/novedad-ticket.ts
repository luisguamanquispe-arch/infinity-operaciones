import { prisma } from "./prisma";
import { parseProgramadoEn } from "./calendario";
import { getOrCreateOrden } from "./tickets";
import { notificarTecnicosNuevos, tecnicoIdsFromTicket, ticketIncludeTecnicos } from "./ticket-tecnicos";
import type { EstadoNovedadTicket, TipoNovedadTicket } from "@prisma/client";

export const TIPO_NOVEDAD_LABELS: Record<TipoNovedadTicket, string> = {
  CLIENTE_AUSENTE: "Cliente no está en casa",
  SOLICITA_REPROGRAMACION: "Cliente solicita nueva fecha/hora",
  OTRO: "Otra novedad",
};

export const ESTADO_NOVEDAD_LABELS: Record<EstadoNovedadTicket, string> = {
  PENDIENTE: "Pendiente de supervisor",
  REPROGRAMADA: "Reprogramada",
  DESCARTADA: "Descartada",
};

const TIPOS_VISITA = new Set([
  "SOPORTE",
  "INSTALACION",
  "RECONEXION",
  "MIGRACION",
  "RETIRO",
  "CORTE",
]);

export function ticketPermiteNovedad(tipo: string) {
  return TIPOS_VISITA.has(tipo);
}

async function pausarCronometroSiActivo(ticketId: string) {
  const orden = await getOrCreateOrden(ticketId);
  const cron = orden.cronometro;
  if (!cron?.activo || cron.pausado) return;

  const now = new Date();
  const pausas: { inicio: string; fin?: string }[] = JSON.parse(cron.pausasJson || "[]");
  pausas.push({ inicio: now.toISOString() });

  await prisma.cronometro.update({
    where: { ordenId: orden.id },
    data: { pausado: true, pausasJson: JSON.stringify(pausas) },
  });
}

export async function reportarNovedadTicket(opts: {
  ticketId: string;
  tecnicoId: string;
  usuarioId: string;
  tipo: TipoNovedadTicket;
  comentario?: string;
  fechaSolicitada?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: opts.ticketId },
    include: { tecnicos: { select: { tecnicoId: true } } },
  });

  if (!ticket) throw new Error("Ticket no encontrado");
  if (!ticketPermiteNovedad(ticket.tipo)) {
    throw new Error("Este tipo de ticket no admite novedades de visita");
  }
  if (["CERRADO", "FINALIZADO", "CANCELADO"].includes(ticket.estado)) {
    throw new Error("El ticket ya está cerrado");
  }

  const pendiente = await prisma.novedadTicket.findFirst({
    where: { ticketId: opts.ticketId, estado: "PENDIENTE" },
  });
  if (pendiente) {
    throw new Error("Ya existe una novedad pendiente en este ticket");
  }

  const fechaSolicitada = opts.fechaSolicitada
    ? parseProgramadoEn(opts.fechaSolicitada)
    : null;

  const novedad = await prisma.novedadTicket.create({
    data: {
      ticketId: opts.ticketId,
      tecnicoId: opts.tecnicoId,
      tipo: opts.tipo,
      comentario: opts.comentario?.trim() || null,
      fechaSolicitada,
      programadoEnAnterior: ticket.programadoEn,
    },
  });

  await pausarCronometroSiActivo(opts.ticketId);

  if (ticket.estado === "EN_PROCESO") {
    await prisma.ticket.update({
      where: { id: opts.ticketId },
      data: { estado: "PENDIENTE" },
    });
  }

  await prisma.eventoTicket.create({
    data: {
      ticketId: opts.ticketId,
      usuarioId: opts.usuarioId,
      accion: "NOVEDAD_REPORTADA",
      metadata: JSON.stringify({
        novedadId: novedad.id,
        tipo: opts.tipo,
        comentario: opts.comentario,
        fechaSolicitada: fechaSolicitada?.toISOString(),
        lat: opts.lat,
        lng: opts.lng,
      }),
    },
  });

  return novedad;
}

export async function listarNovedadesSupervisor(estado: EstadoNovedadTicket = "PENDIENTE") {
  return prisma.novedadTicket.findMany({
    where: { estado },
    include: {
      ticket: {
        include: {
          cliente: { select: { nombre: true, telefono: true, sector: true, direccion: true } },
          tecnicos: { include: { tecnico: { include: { usuario: { select: { nombre: true } } } } } },
        },
      },
      tecnico: { include: { usuario: { select: { nombre: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
}

export async function resolverNovedadTicket(opts: {
  novedadId: string;
  usuarioId: string;
  accion: "REPROGRAMAR" | "DESCARTAR";
  programadoEn?: string | null;
  tecnicoIds?: string[];
  notaSupervisor?: string;
}) {
  const novedad = await prisma.novedadTicket.findUnique({
    where: { id: opts.novedadId },
    include: {
      ticket: { include: { tecnicos: { select: { tecnicoId: true } } } },
    },
  });

  if (!novedad) throw new Error("Novedad no encontrada");
  if (novedad.estado !== "PENDIENTE") {
    throw new Error("Esta novedad ya fue procesada");
  }

  const now = new Date();

  if (opts.accion === "DESCARTAR") {
    await prisma.$transaction([
      prisma.novedadTicket.update({
        where: { id: opts.novedadId },
        data: {
          estado: "DESCARTADA",
          resueltaPorId: opts.usuarioId,
          resueltaEn: now,
        },
      }),
      prisma.eventoTicket.create({
        data: {
          ticketId: novedad.ticketId,
          usuarioId: opts.usuarioId,
          accion: "NOVEDAD_DESCARTADA",
          metadata: JSON.stringify({ novedadId: novedad.id, nota: opts.notaSupervisor }),
        },
      }),
    ]);
    return { ok: true, accion: "DESCARTAR" };
  }

  if (!opts.programadoEn) {
    throw new Error("Indique la nueva fecha y hora de visita");
  }

  const nuevaFecha = parseProgramadoEn(opts.programadoEn);
  if (!nuevaFecha) {
    throw new Error("Fecha de reprogramación inválida");
  }
  await prisma.$transaction(async (tx) => {
    await tx.novedadTicket.update({
      where: { id: opts.novedadId },
      data: {
        estado: "REPROGRAMADA",
        resueltaPorId: opts.usuarioId,
        resueltaEn: now,
        programadoEnNuevo: nuevaFecha,
      },
    });

    if (opts.tecnicoIds && opts.tecnicoIds.length > 0) {
      await tx.ticketTecnico.deleteMany({ where: { ticketId: novedad.ticketId } });
      await tx.ticketTecnico.createMany({
        data: opts.tecnicoIds.map((tecnicoId) => ({
          ticketId: novedad.ticketId,
          tecnicoId,
        })),
      });
    }

    const ticket = await tx.ticket.update({
      where: { id: novedad.ticketId },
      data: {
        programadoEn: nuevaFecha,
        estado: "PENDIENTE",
        ...(opts.tecnicoIds?.length ? { tecnicoId: opts.tecnicoIds[0] } : {}),
      },
      include: { tecnicos: { select: { tecnicoId: true } }, cliente: true },
    });

    await tx.eventoTicket.create({
      data: {
        ticketId: novedad.ticketId,
        usuarioId: opts.usuarioId,
        accion: "NOVEDAD_REPROGRAMADA",
        metadata: JSON.stringify({
          novedadId: novedad.id,
          programadoEnAnterior: novedad.programadoEnAnterior?.toISOString(),
          programadoEnNuevo: nuevaFecha.toISOString(),
          nota: opts.notaSupervisor,
        }),
      },
    });

    await tx.eventoTicket.create({
      data: {
        ticketId: novedad.ticketId,
        usuarioId: opts.usuarioId,
        accion: "TICKET_PROGRAMADO",
        metadata: JSON.stringify({
          programadoEn: nuevaFecha.toISOString(),
          origen: "novedad_supervisor",
        }),
      },
    });

    return ticket;
  });

  const anteriores = tecnicoIdsFromTicket(novedad.ticket);
  const ticketNotif = await prisma.ticket.findUnique({
    where: { id: novedad.ticketId },
    include: ticketIncludeTecnicos,
  });
  if (ticketNotif) {
    const nuevos = tecnicoIdsFromTicket(ticketNotif);
    await notificarTecnicosNuevos(ticketNotif, anteriores, nuevos).catch(() => {});
  }

  return { ok: true, accion: "REPROGRAMAR", programadoEn: nuevaFecha };
}

export async function novedadPendienteTicket(ticketId: string) {
  return prisma.novedadTicket.findFirst({
    where: { ticketId, estado: "PENDIENTE" },
    orderBy: { createdAt: "desc" },
  });
}
