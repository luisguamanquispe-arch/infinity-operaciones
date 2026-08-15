/**
 * Trazas del ciclo de vida del ticket (Operaciones ↔ técnico).
 * Solo ids y código: sin nombres, teléfonos ni fotos.
 */

export const FLUJO_TICKET = {
  TICKET_CREATED: "ticket_created",
  TECHNICIAN_ASSIGNED: "technician_assigned",
  TICKET_SENT_TO_TECHNICIAN: "ticket_sent_to_technician",
  TICKET_RECEIVED_BY_TECHNICIAN: "ticket_received_by_technician",
  WORK_STARTED: "work_started",
  REPORT_SUBMITTED: "report_submitted",
  PHOTOS_UPLOADED: "photos_uploaded",
  REPORT_RECEIVED: "report_received",
  TICKET_CLOSED: "ticket_closed",
  HISTORY_UPDATED: "history_updated",
} as const;

export type FlujoTicketEvento = (typeof FLUJO_TICKET)[keyof typeof FLUJO_TICKET];

export function logFlujoTicket(
  evento: FlujoTicketEvento,
  payload: {
    ticketId?: string;
    codigo?: string;
    clienteId?: string;
    tecnicoId?: string;
    ok?: boolean;
    resultado?: string;
    error?: string;
    [key: string]: string | number | boolean | undefined;
  }
): void {
  const { ticketId, codigo, clienteId, tecnicoId, ok, resultado, error, ...rest } = payload;
  console.info(`[flujo] ${evento}`, {
    ts: new Date().toISOString(),
    ticketId: ticketId ?? undefined,
    clienteId: clienteId ?? undefined,
    tecnicoId: tecnicoId ?? undefined,
    codigo: codigo ?? undefined,
    ok: ok ?? !error,
    resultado: resultado ?? undefined,
    error: error ?? undefined,
    ...rest,
  });
}
