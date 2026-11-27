import type { Prisma } from "@prisma/client";
import { diaKey } from "./calendario";
import { ESTADOS_TICKET_OPERATIVOS } from "./ticket-cerrado";

export const TZ_NEGOCIO_ECUADOR = "America/Guayaquil";

/**
 * Calcula los límites exactos del día actual en Ecuador (America/Guayaquil, UTC-5 sin DST)
 * convertidos a instantes Date (UTC) para consultas en PostgreSQL/Prisma.
 *
 * Usa intervalo semiabierto [inicio, finExclusivo) para evitar ambigüedades de milisegundos.
 */
export function rangoDiaActualEcuador(now: Date = new Date()): {
  fechaLocal: string;
  inicio: Date;
  finExclusivo: Date;
  finInclusivo: Date;
} {
  const fechaLocal = diaKey(now); // YYYY-MM-DD en America/Guayaquil
  const inicio = new Date(`${fechaLocal}T00:00:00.000-05:00`);
  const finExclusivo = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  const finInclusivo = new Date(finExclusivo.getTime() - 1);
  return { fechaLocal, inicio, finExclusivo, finInclusivo };
}

/**
 * Fecha de atención/programación efectiva de un ticket:
 * - Si tiene `programadoEn`, esa es la fecha de visita/atención.
 * - Si no tiene `programadoEn`, se usa `createdAt`.
 */
export function fechaAtencionTicket(ticket: {
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

/**
 * Indica si la fecha de atención/programación del ticket cae dentro del día actual
 * en America/Guayaquil.
 */
export function ticketCorrespondeAHoyEcuador(
  ticket: { programadoEn?: Date | string | null; createdAt: Date | string },
  now: Date = new Date()
): boolean {
  const { inicio, finExclusivo } = rangoDiaActualEcuador(now);
  const fecha = fechaAtencionTicket(ticket);
  const ms = fecha.getTime();
  if (Number.isNaN(ms)) return false;
  return ms >= inicio.getTime() && ms < finExclusivo.getTime();
}

export interface TicketVisibilidadTecnicoInput {
  estado: string;
  programadoEn?: Date | string | null;
  createdAt: Date | string;
  tecnicoId: string | null;
  tecnicos?: { tecnicoId: string }[];
  orden?: { finalizadoEn?: Date | string | null } | null;
}

const ESTADOS_OPERATIVOS_SET = new Set<string>(ESTADOS_TICKET_OPERATIVOS);

/**
 * Regla pura (solo lectura) que determina si un ticket debe aparecer en la vista
 * principal del técnico para la fecha actual en America/Guayaquil.
 */
export function ticketVisibleParaTecnicoHoy(
  ticket: TicketVisibilidadTecnicoInput,
  tecnicoId: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!tecnicoId) return false;
  const asignado =
    ticket.tecnicoId === tecnicoId ||
    (ticket.tecnicos?.some((t) => t.tecnicoId === tecnicoId) ?? false);
  if (!asignado) return false;
  if (!ESTADOS_OPERATIVOS_SET.has(ticket.estado)) return false;
  if (ticket.orden?.finalizadoEn != null) return false;
  return ticketCorrespondeAHoyEcuador(ticket, now);
}

/**
 * Cláusula WHERE de Prisma para obtener únicamente los tickets activos asignados
 * al técnico cuya fecha de atención (`programadoEn`, o `createdAt` si no tiene
 * programación) corresponde al día actual en America/Guayaquil.
 *
 * Excluye tickets de fechas futuras y tickets de fechas anteriores.
 */
export function whereTicketsTecnicoHoyEcuador(
  tecnicoId: string,
  now: Date = new Date()
): Prisma.TicketWhereInput {
  const { inicio, finExclusivo } = rangoDiaActualEcuador(now);
  return {
    AND: [
      { estado: { in: [...ESTADOS_TICKET_OPERATIVOS] } },
      { OR: [{ orden: { is: null } }, { orden: { finalizadoEn: null } }] },
      { OR: [{ tecnicoId }, { tecnicos: { some: { tecnicoId } } }] },
      {
        OR: [
          { programadoEn: { not: null, gte: inicio, lt: finExclusivo } },
          {
            AND: [
              { programadoEn: null },
              { createdAt: { gte: inicio, lt: finExclusivo } },
            ],
          },
        ],
      },
    ],
  };
}
