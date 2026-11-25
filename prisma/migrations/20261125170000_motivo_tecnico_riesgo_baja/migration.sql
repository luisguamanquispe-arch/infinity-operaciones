-- Motivo técnico estructurado + alerta de cliente en riesgo de baja.
-- Additive / compatible con tickets existentes (campos nullable / defaults).

DO $$ BEGIN
  CREATE TYPE "ClienteSituacionTicket" AS ENUM (
    'CONFORME',
    'INCONFORME',
    'MOLESTO_FALTA_ATENCION',
    'INTENCION_CANCELAR'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ResultadoGestionRiesgoBaja" AS ENUM (
    'CONTACTO_REALIZADO',
    'RECUPERADO',
    'CONTINUA_RIESGO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "motivoCategoria" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoCategoriaOtro" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoProblema" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoProblemaOtro" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoDetalle" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoImpacto" TEXT,
  ADD COLUMN IF NOT EXISTS "motivoObservaciones" TEXT,
  ADD COLUMN IF NOT EXISTS "clienteSituacion" "ClienteSituacionTicket",
  ADD COLUMN IF NOT EXISTS "clienteRiesgoBaja" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "clienteRiesgoBajaMotivo" TEXT,
  ADD COLUMN IF NOT EXISTS "clienteRiesgoBajaActivadoEn" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "clienteRiesgoBajaActivadoPorId" TEXT,
  ADD COLUMN IF NOT EXISTS "clienteRiesgoBajaResueltoEn" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "clienteRiesgoBajaResueltoPorId" TEXT;

CREATE INDEX IF NOT EXISTS "Ticket_clienteRiesgoBaja_clienteRiesgoBajaResueltoEn_idx"
  ON "Ticket"("clienteRiesgoBaja", "clienteRiesgoBajaResueltoEn");

DO $$ BEGIN
  ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_clienteRiesgoBajaActivadoPorId_fkey"
    FOREIGN KEY ("clienteRiesgoBajaActivadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Ticket"
    ADD CONSTRAINT "Ticket_clienteRiesgoBajaResueltoPorId_fkey"
    FOREIGN KEY ("clienteRiesgoBajaResueltoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TicketGestionRiesgoBaja" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "usuarioId" TEXT,
  "usuarioNombre" TEXT NOT NULL,
  "resultado" "ResultadoGestionRiesgoBaja" NOT NULL,
  "observaciones" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketGestionRiesgoBaja_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TicketGestionRiesgoBaja_ticketId_createdAt_idx"
  ON "TicketGestionRiesgoBaja"("ticketId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "TicketGestionRiesgoBaja"
    ADD CONSTRAINT "TicketGestionRiesgoBaja_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TicketGestionRiesgoBaja"
    ADD CONSTRAINT "TicketGestionRiesgoBaja_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
