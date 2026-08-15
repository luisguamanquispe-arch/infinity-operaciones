/**
 * Validación pura de asignación Ticket.tecnicoId + filas TicketTecnico.
 * Sin Prisma: se puede probar sin BD.
 */

export const MSG_ASIGNACION_SIN_TECNICO =
  "Debe asignar al menos un técnico. El ticket no puede quedar sin tecnicoId ni TicketTecnico.";

export const MSG_ASIGNACION_INCOMPLETA =
  "La asignación no se guardó completa: falta Ticket.tecnicoId o el registro en TicketTecnico. Reintente.";

export class AsignacionIncompletaError extends Error {
  constructor(message: string = MSG_ASIGNACION_INCOMPLETA) {
    super(message);
    this.name = "AsignacionIncompletaError";
  }
}

export function asignacionEstaCompleta(
  ticket: {
    tecnicoId: string | null;
    tecnicos?: { tecnicoId: string }[];
  } | null,
  expectedIds: string[]
): { ok: true } | { ok: false; error: string } {
  const unicos = [...new Set(expectedIds.filter(Boolean))];
  if (unicos.length === 0) {
    return { ok: false, error: MSG_ASIGNACION_SIN_TECNICO };
  }
  if (!ticket) {
    return { ok: false, error: MSG_ASIGNACION_INCOMPLETA };
  }
  if (!ticket.tecnicoId) {
    return { ok: false, error: "Falta Ticket.tecnicoId tras la asignación." };
  }
  if (ticket.tecnicoId !== unicos[0]) {
    return {
      ok: false,
      error: "Ticket.tecnicoId no coincide con el primer técnico asignado.",
    };
  }
  const rows = new Set((ticket.tecnicos ?? []).map((t) => t.tecnicoId));
  for (const id of unicos) {
    if (!rows.has(id)) {
      return {
        ok: false,
        error: "Falta el registro TicketTecnico para uno o más técnicos asignados.",
      };
    }
  }
  return { ok: true };
}
