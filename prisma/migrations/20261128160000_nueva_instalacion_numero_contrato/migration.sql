-- Additive migration: TipoTrabajo.NUEVA_INSTALACION, Ticket.numeroContratoInstalar
-- y tabla TicketMaterialInstalacion (sin integración con Kardex/Inventario).
-- 100% compatible con tickets existentes (sin borrado ni alteración de datos previos).

ALTER TYPE "TipoTrabajo" ADD VALUE IF NOT EXISTS 'NUEVA_INSTALACION';

ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "numeroContratoInstalar" TEXT;

CREATE TABLE IF NOT EXISTS "TicketMaterialInstalacion" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "categoria" TEXT NOT NULL,
  "item" TEXT NOT NULL,
  "cantidad" DOUBLE PRECISION NOT NULL,
  "unidad" TEXT NOT NULL,
  "marca" TEXT,
  "series" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "orden" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TicketMaterialInstalacion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TicketMaterialInstalacion_ticketId_idx" ON "TicketMaterialInstalacion"("ticketId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TicketMaterialInstalacion_ticketId_fkey'
  ) THEN
    ALTER TABLE "TicketMaterialInstalacion"
      ADD CONSTRAINT "TicketMaterialInstalacion_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
