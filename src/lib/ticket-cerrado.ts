import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export const MSG_ORDEN_CERRADA =
  "La orden de servicio está cerrada. No se puede modificar el ticket.";

const ESTADOS_TERMINALES = new Set(["CERRADO", "FINALIZADO", "CANCELADO"]);

export const ESTADOS_TICKET_OPERATIVOS = ["PENDIENTE", "LEIDO", "EN_PROCESO"] as const;

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

/**
 * Filtro de lectura (F4/E5): tickets operativos cuya orden no está finalizada.
 * No escribe en BD — evita que un GET “cierre” tickets en masa.
 */
export function whereTicketOperativamenteAbierto(
  extra?: Prisma.TicketWhereInput
): Prisma.TicketWhereInput {
  const base: Prisma.TicketWhereInput = {
    estado: { in: [...ESTADOS_TICKET_OPERATIVOS] },
    OR: [{ orden: { is: null } }, { orden: { finalizadoEn: null } }],
  };
  if (!extra) return base;
  return { AND: [base, extra] };
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

/**
 * Alinea ticket.estado = CERRADO cuando la orden ya tiene finalizadoEn.
 * F4/E5: NO usar en GET/listados. Solo cierre explícito o mantenimiento admin.
 */
export async function sincronizarTicketsConOrdenCerrada(): Promise<number> {
  const result = await prisma.ticket.updateMany({
    where: {
      estado: { in: ["PENDIENTE", "LEIDO", "EN_PROCESO", "FINALIZADO"] },
      orden: { finalizadoEn: { not: null } },
    },
    data: { estado: "CERRADO" },
  });
  return result.count;
}

/**
 * Sincroniza un ticket si su orden está cerrada.
 * F4/E5: preferir estadoTicketEfectivo en lecturas; usar esto solo en writes.
 */
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
