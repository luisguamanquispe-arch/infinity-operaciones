-- Índice para historial de soportes por cliente (paginación por fecha).
CREATE INDEX IF NOT EXISTS "Ticket_clienteId_createdAt_idx" ON "Ticket"("clienteId", "createdAt");
