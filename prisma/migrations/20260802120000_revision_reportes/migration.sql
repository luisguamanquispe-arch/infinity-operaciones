-- Revisión / devolución de reportes ST e INF
CREATE TYPE "EstadoRevision" AS ENUM (
  'PENDIENTE_REVISION',
  'DEVUELTO_CORRECCION',
  'CORREGIDO',
  'APROBADO'
);

ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "estadoRevision" "EstadoRevision";

CREATE INDEX IF NOT EXISTS "Ticket_estadoRevision_idx" ON "Ticket"("estadoRevision");

CREATE TABLE IF NOT EXISTS "RevisionHistorial" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "accion" TEXT NOT NULL,
  "estadoAnterior" "EstadoRevision",
  "estadoNuevo" "EstadoRevision" NOT NULL,
  "motivo" TEXT,
  "observaciones" TEXT,
  "usuarioId" TEXT,
  "usuarioNombre" TEXT NOT NULL,
  "tecnicoId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevisionHistorial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RevisionHistorial_ticketId_createdAt_idx"
  ON "RevisionHistorial"("ticketId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "RevisionHistorial"
    ADD CONSTRAINT "RevisionHistorial_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RevisionHistorial"
    ADD CONSTRAINT "RevisionHistorial_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
