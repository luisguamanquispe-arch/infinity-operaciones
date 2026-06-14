import { prisma } from "./prisma";
import { getOrCreateOrden, calcularDuracionCronometro } from "./tickets";

export interface IniciarCronometroParams {
  ticketId: string;
  tecnicoId: string;
  usuarioId: string;
  lat?: number | null;
  lng?: number | null;
}

/** Inicia el cronómetro si aún no arrancó (idempotente). */
export async function iniciarCronometroTicket({
  ticketId,
  tecnicoId,
  usuarioId,
  lat,
  lng,
}: IniciarCronometroParams): Promise<{ yaIniciado: boolean; duracionSegundos: number }> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { estado: true },
  });

  if (!ticket || ["CERRADO", "FINALIZADO", "CANCELADO"].includes(ticket.estado)) {
    return { yaIniciado: true, duracionSegundos: 0 };
  }

  const orden = await getOrCreateOrden(ticketId);
  const cron = orden.cronometro;

  if (cron?.inicio) {
    if (lat != null && lng != null && orden.latInicio == null) {
      await prisma.ordenServicio.update({
        where: { id: orden.id },
        data: { latInicio: lat, lngInicio: lng },
      });
      await prisma.tecnico.update({
        where: { id: tecnicoId },
        data: { lat, lng },
      });
    }

    const duracionSegundos = calcularDuracionCronometro(
      cron.inicio,
      cron.fin,
      cron.pausasJson
    );
    return { yaIniciado: true, duracionSegundos };
  }

  const now = new Date();

  await prisma.cronometro.update({
    where: { ordenId: orden.id },
    data: {
      inicio: now,
      activo: true,
      pausado: false,
    },
  });

  await prisma.ordenServicio.update({
    where: { id: orden.id },
    data: {
      iniciadoEn: now,
      ...(lat != null && lng != null ? { latInicio: lat, lngInicio: lng } : {}),
    },
  });

  if (ticket.estado === "PENDIENTE") {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { estado: "EN_PROCESO" },
    });
  }

  await prisma.tecnico.update({
    where: { id: tecnicoId },
    data: {
      estadoActual: "TRABAJANDO",
      ...(lat != null && lng != null ? { lat, lng } : {}),
    },
  });

  await prisma.eventoTicket.create({
    data: {
      ticketId,
      usuarioId,
      accion: "CRONOMETRO_INICIADO",
      metadata: JSON.stringify({
        lat: lat ?? null,
        lng: lng ?? null,
        origen: "apertura_ticket",
      }),
    },
  });

  return { yaIniciado: false, duracionSegundos: 0 };
}
