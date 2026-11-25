-- Idempotencia de alerta/resolución de riesgo de baja (índices únicos parciales).
-- Additive: no altera filas existentes salvo rechazo de duplicados futuros.

CREATE UNIQUE INDEX IF NOT EXISTS "EventoTicket_alerta_riesgo_baja_ticket_uidx"
  ON "EventoTicket" ("ticketId")
  WHERE "accion" = 'ALERTA_CLIENTE_RIESGO_BAJA';

CREATE UNIQUE INDEX IF NOT EXISTS "EventoTicket_riesgo_baja_resuelto_ticket_uidx"
  ON "EventoTicket" ("ticketId")
  WHERE "accion" = 'CLIENTE_RIESGO_BAJA_RESUELTO';
