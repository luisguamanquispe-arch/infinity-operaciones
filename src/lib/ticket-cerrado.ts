import { prisma } from "./prisma";

export const MSG_ORDEN_CERRADA =
  "La orden de servicio está cerrada. No se puede modificar el ticket.";

const ESTADOS_TERMINALES = new Set(["CERRADO", "FINALIZADO", "CANCELADO"]);

export function ordenServicioCerrada(
  orden: { finalizadoEn: Date | string | null } | null | undefined
): boolean {
  return !!orden?.finalizadoEn;
}

/** Ticket cerrado por estado o porque la orden ya tiene fecha de cierre. */
export function ticketEstaCerrado(
  ticket: { estado: string },
  orden?: { finalizadoEn: Date | string | null } | null
): boolean {
  if (ESTADOS_TERMINALES.has(ticket.estado)) return true;
  return ordenServicioCerrada(orden);
}

/** Estado mostrado en listados cuando la orden cerró pero el ticket no se sincronizó aún. */
export function estadoTicketEfectivo(
  ticket: { estado: string },
  orden?: { finalizadoEn: Date | string | null } | null
): string {
  if (ticket.estado === "CANCELADO") return "CANCELADO";
  if (ordenServicioCerrada(orden)) return "CERRADO";
  return ticket.estado;
}

export function ticketPermiteEdicion(
  ticket: { estado: string },
  orden?: { finalizadoEn: Date | string | null } | null
): boolean {
  return !ticketEstaCerrado(ticket, orden);
}

export async function verificarTicketEditable(
  ticketId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      estado: true,
      orden: { select: { finalizadoEn: true } },
    },
  });

  if (!ticket) {
    return { ok: false, status: 404, error: "Ticket no encontrado" };
  }

  if (!ticketPermiteEdicion(ticket, ticket.orden)) {
    return { ok: false, status: 409, error: MSG_ORDEN_CERRADA };
  }

  return { ok: true };
}

/** Alinea ticket.estado = CERRADO cuando la orden ya tiene finalizadoEn. */
export async function sincronizarTicketsConOrdenCerrada(): Promise<number> {
  const result = await prisma.ticket.updateMany({
    where: {
      estado: { in: ["PENDIENTE", "EN_PROCESO", "FINALIZADO"] },
      orden: { finalizadoEn: { not: null } },
    },
    data: { estado: "CERRADO" },
  });
  return result.count;
}

/** Sincroniza un ticket si su orden está cerrada. */
export async function sincronizarTicketSiOrdenCerrada(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      estado: true,
      orden: { select: { finalizadoEn: true } },
    },
  });

  if (
    !ticket ||
    ticket.estado === "CANCELADO" ||
    !ordenServicioCerrada(ticket.orden)
  ) {
    return;
  }

  if (!ESTADOS_TERMINALES.has(ticket.estado)) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { estado: "CERRADO" },
    });
  }
}
