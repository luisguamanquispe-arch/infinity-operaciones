import type { Prisma } from "@prisma/client";
import { ESTADOS_TICKET_OPERATIVOS, whereTicketOperativamenteAbierto } from "./ticket-cerrado";

/** Días sin atención para sacar el ticket de listas activas. */
export const DIAS_SIN_ATENCION_LIMITE = 4;

/** Semáforo de tiempo (antes de vencer / vencido). */
export type FaseSemaforoTiempo = "verde" | "amarillo" | "rojo";

export const FASE_SEMAFORO_TIEMPO_LABELS: Record<FaseSemaforoTiempo, string> = {
  verde: "Dentro de plazo (0–2 días)",
  amarillo: "Por vencer (2–4 días)",
  rojo: "Sin atención (+4 días)",
};

export function limiteSinAtencion(now: Date = new Date()): Date {
  return new Date(now.getTime() - DIAS_SIN_ATENCION_LIMITE * 24 * 60 * 60 * 1000);
}

/** Fecha de referencia: visita programada o, si no hay, creación. */
export function referenciaAtencionTicket(ticket: {
  programadoEn?: Date | string | null;
  createdAt: Date | string;
}): Date {
  if (ticket.programadoEn) {
    return ticket.programadoEn instanceof Date
      ? ticket.programadoEn
      : new Date(ticket.programadoEn);
  }
  return ticket.createdAt instanceof Date
    ? ticket.createdAt
    : new Date(ticket.createdAt);
}

export function diasDesdeReferencia(
  ticket: { programadoEn?: Date | string | null; createdAt: Date | string },
  now: Date = new Date()
): number {
  const ref = referenciaAtencionTicket(ticket).getTime();
  return Math.max(0, (now.getTime() - ref) / (24 * 60 * 60 * 1000));
}

export function esTicketNoAtendido(
  ticket: { programadoEn?: Date | string | null; createdAt: Date | string },
  now: Date = new Date()
): boolean {
  return diasDesdeReferencia(ticket, now) >= DIAS_SIN_ATENCION_LIMITE;
}

export function faseSemaforoTiempo(
  ticket: { programadoEn?: Date | string | null; createdAt: Date | string },
  now: Date = new Date()
): FaseSemaforoTiempo {
  const dias = diasDesdeReferencia(ticket, now);
  if (dias >= DIAS_SIN_ATENCION_LIMITE) return "rojo";
  if (dias >= 2) return "amarillo";
  return "verde";
}

/**
 * Tickets operativos vencidos por antigüedad (sin atención ≥ 4 días).
 * No incluye reportes DEVUELTO_CORRECCION.
 */
export function whereTicketNoAtendido(
  extra?: Prisma.TicketWhereInput,
  now: Date = new Date()
): Prisma.TicketWhereInput {
  const limite = limiteSinAtencion(now);
  const base: Prisma.TicketWhereInput = {
    AND: [
      { estado: { in: [...ESTADOS_TICKET_OPERATIVOS] } },
      {
        OR: [{ orden: { is: null } }, { orden: { finalizadoEn: null } }],
      },
      {
        OR: [
          { programadoEn: { not: null, lt: limite } },
          { AND: [{ programadoEn: null }, { createdAt: { lt: limite } }] },
        ],
      },
    ],
  };
  if (!extra) return base;
  return { AND: [base, extra] };
}

/**
 * Tickets que deben aparecer en listas de trabajo activas:
 * operativos abiertos (o corrección) y aún dentro del plazo de 4 días.
 */
export function whereTicketActivoEnLista(
  extra?: Prisma.TicketWhereInput,
  now: Date = new Date()
): Prisma.TicketWhereInput {
  const limite = limiteSinAtencion(now);
  const base: Prisma.TicketWhereInput = {
    OR: [
      {
        AND: [
          { estado: { in: [...ESTADOS_TICKET_OPERATIVOS] } },
          {
            OR: [{ orden: { is: null } }, { orden: { finalizadoEn: null } }],
          },
          {
            OR: [
              { programadoEn: { gte: limite } },
              { AND: [{ programadoEn: null }, { createdAt: { gte: limite } }] },
            ],
          },
        ],
      },
      { estadoRevision: "DEVUELTO_CORRECCION" },
    ],
  };
  if (!extra) return base;
  return { AND: [base, extra] };
}

/** Atajo: mismo criterio operativo histórico (sin filtro de edad). */
export function whereTicketAbiertoSinFiltroEdad(
  extra?: Prisma.TicketWhereInput
): Prisma.TicketWhereInput {
  return whereTicketOperativamenteAbierto(extra);
}
