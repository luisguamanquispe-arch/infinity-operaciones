-- Cronómetro de lectura y atención de tickets de soporte.
-- Aditivo y compatible con tickets existentes (tabla 1:1 opcional por ticketId único).

CREATE TABLE IF NOT EXISTS "TicketCronometroAtencion" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "tecnicoId" TEXT NOT NULL,
  "iniciadoPorUsuarioId" TEXT NOT NULL,
  "iniciadoEn" TIMESTAMP(3) NOT NULL,
  "finalizadoEn" TIMESTAMP(3),
  "finalizadoPorUsuarioId" TEXT,
  "finalizadoPorTecnicoId" TEXT,
  "duracionSegundos" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketCronometroAtencion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TicketCronometroAtencion_ticketId_key"
  ON "TicketCronometroAtencion"("ticketId");

CREATE INDEX IF NOT EXISTS "TicketCronometroAtencion_tecnicoId_iniciadoEn_idx"
  ON "TicketCronometroAtencion"("tecnicoId", "iniciadoEn");

CREATE INDEX IF NOT EXISTS "TicketCronometroAtencion_finalizadoEn_idx"
  ON "TicketCronometroAtencion"("finalizadoEn");

DO $$ BEGIN
  ALTER TABLE "TicketCronometroAtencion"
    ADD CONSTRAINT "TicketCronometroAtencion_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TicketCronometroAtencion"
    ADD CONSTRAINT "TicketCronometroAtencion_tecnicoId_fkey"
    FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TicketCronometroAtencion"
    ADD CONSTRAINT "TicketCronometroAtencion_iniciadoPorUsuarioId_fkey"
    FOREIGN KEY ("iniciadoPorUsuarioId") REFERENCES "Usuario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TicketCronometroAtencion"
    ADD CONSTRAINT "TicketCronometroAtencion_finalizadoPorUsuarioId_fkey"
    FOREIGN KEY ("finalizadoPorUsuarioId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TicketCronometroAtencion"
    ADD CONSTRAINT "TicketCronometroAtencion_finalizadoPorTecnicoId_fkey"
    FOREIGN KEY ("finalizadoPorTecnicoId") REFERENCES "Tecnico"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
