-- Additive migration: Confirmación de disponibilidad del cliente antes del desplazamiento técnico
-- Compatible with all existing/historical tickets (zero columns modified or dropped on Ticket).

CREATE TYPE "EstadoConfirmacionVisita" AS ENUM (
  'PENDIENTE_CONFIRMACION',
  'CONFIRMADO',
  'SOLICITA_REPROGRAMACION',
  'NO_DISPONIBLE',
  'SIN_RESPUESTA',
  'CANCELADO',
  'EXENTO'
);

CREATE TABLE "TicketConfirmacionVisita" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "estado" "EstadoConfirmacionVisita" NOT NULL DEFAULT 'PENDIENTE_CONFIRMACION',
  "requierePresencia" BOOLEAN NOT NULL DEFAULT true,
  "exentoMotivo" TEXT,
  "exentoPorUsuarioId" TEXT,
  "exentoEn" TIMESTAMP(3),
  "token" TEXT,
  "tokenExpiraEn" TIMESTAMP(3),
  "tokenRevocadoEn" TIMESTAMP(3),
  "programadoEnConfirmado" TIMESTAMP(3),
  "confirmadoEn" TIMESTAMP(3),
  "confirmadoPorCanal" TEXT,
  "confirmadoPorUsuarioId" TEXT,
  "confirmadoPorNombre" TEXT,
  "personaRecibe" TEXT,
  "horarioSolicitado" TEXT,
  "observacionCliente" TEXT,
  "respondidoEn" TIMESTAMP(3),
  "enCaminoEn" TIMESTAMP(3),
  "enCaminoPorTecnicoId" TEXT,
  "enCaminoPorUsuarioId" TEXT,
  "ultimoEnvioEn" TIMESTAMP(3),
  "ultimoEnvioCanal" TEXT,
  "ultimoEnvioEstado" TEXT,
  "enviosCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TicketConfirmacionVisita_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TicketConfirmacionVisita_ticketId_key" ON "TicketConfirmacionVisita"("ticketId");
CREATE UNIQUE INDEX "TicketConfirmacionVisita_token_key" ON "TicketConfirmacionVisita"("token");
CREATE INDEX "TicketConfirmacionVisita_estado_idx" ON "TicketConfirmacionVisita"("estado");
CREATE INDEX "TicketConfirmacionVisita_tokenExpiraEn_idx" ON "TicketConfirmacionVisita"("tokenExpiraEn");
CREATE INDEX "TicketConfirmacionVisita_programadoEnConfirmado_idx" ON "TicketConfirmacionVisita"("programadoEnConfirmado");

ALTER TABLE "TicketConfirmacionVisita"
  ADD CONSTRAINT "TicketConfirmacionVisita_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketConfirmacionVisita"
  ADD CONSTRAINT "TicketConfirmacionVisita_confirmadoPorUsuarioId_fkey"
  FOREIGN KEY ("confirmadoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TicketConfirmacionVisita"
  ADD CONSTRAINT "TicketConfirmacionVisita_exentoPorUsuarioId_fkey"
  FOREIGN KEY ("exentoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TicketConfirmacionVisita"
  ADD CONSTRAINT "TicketConfirmacionVisita_enCaminoPorTecnicoId_fkey"
  FOREIGN KEY ("enCaminoPorTecnicoId") REFERENCES "Tecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TicketConfirmacionVisita"
  ADD CONSTRAINT "TicketConfirmacionVisita_enCaminoPorUsuarioId_fkey"
  FOREIGN KEY ("enCaminoPorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
