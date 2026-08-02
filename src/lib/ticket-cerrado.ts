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
  ticket: { estado: string; estadoRevision?: string | null },
  orden?: { finalizadoEn: Date | string | null } | null
): boolean {
  if (ticket.estadoRevision === "DEVUELTO_CORRECCION") return false;
  if (ESTADOS_TERMINALES.has(ticket.estado)) return true;
  return ordenServicioCerrada(orden);
}

/** Estado mostrado en listados cuando la orden cerró pero el ticket no se sincronizó aún. */
export function estadoTicketEfectivo(
  ticket: { estado: string; estadoRevision?: string | null },
  orden?: { finalizadoEn: Date | string | null } | null
): string {
  if (ticket.estado === "CANCELADO") return "CANCELADO";
  if (ticket.estadoRevision === "DEVUELTO_CORRECCION") return "EN_PROCESO";
  if (ticket.estadoRevision === "APROBADO") return "CERRADO";
  if (
    ordenServicioCerrada(orden) &&
    (ticket.estadoRevision === "PENDIENTE_REVISION" ||
      ticket.estadoRevision === "CORREGIDO")
  ) {
    return "FINALIZADO";
  }
  if (ordenServicioCerrada(orden)) return "CERRADO";
  return ticket.estado;
}

export function ticketPermiteEdicion(
  ticket: { estado: string; estadoRevision?: string | null },
  orden?: { finalizadoEn: Date | string | null } | null
): boolean {
  if (ticket.estadoRevision === "DEVUELTO_CORRECCION") return true;
  return !ticketEstaCerrado(ticket, orden);
}

/**
 * Filtro de lectura: tickets operativos abiertos + reportes devueltos a corrección.
 */
export function whereTicketOperativamenteAbierto(
  extra?: Prisma.TicketWhereInput
): Prisma.TicketWhereInput {
  const base: Prisma.TicketWhereInput = {
    OR: [
      {
        AND: [
          { estado: { in: [...ESTADOS_TICKET_OPERATIVOS] } },
          {
            OR: [{ orden: { is: null } }, { orden: { finalizadoEn: null } }],
          },
        ],
      },
      { estadoRevision: "DEVUELTO_CORRECCION" },
    ],
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
      estadoRevision: true,
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
 * No fuerza cierre si está en cola de revisión o devuelto.
 */
export async function sincronizarTicketsConOrdenCerrada(): Promise<number> {
  const result = await prisma.ticket.updateMany({
    where: {
      estado: { in: ["PENDIENTE", "LEIDO", "EN_PROCESO", "FINALIZADO"] },
      orden: { finalizadoEn: { not: null } },
      OR: [{ estadoRevision: null }, { estadoRevision: "APROBADO" }],
    },
    data: { estado: "CERRADO" },
  });
  return result.count;
}

/**
 * Sincroniza un ticket si su orden está cerrada.
 * No aplica a tickets en flujo de revisión.
 */
export async function sincronizarTicketSiOrdenCerrada(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      estado: true,
      estadoRevision: true,
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

  if (
    ticket.estadoRevision === "PENDIENTE_REVISION" ||
    ticket.estadoRevision === "CORREGIDO" ||
    ticket.estadoRevision === "DEVUELTO_CORRECCION"
  ) {
    return;
  }

  if (ticket.estadoRevision == null && !ESTADOS_TERMINALES.has(ticket.estado)) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { estado: "CERRADO" },
    });
  }
}
