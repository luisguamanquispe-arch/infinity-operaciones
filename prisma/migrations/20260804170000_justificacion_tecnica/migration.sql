-- Justificación técnica para cierre sin checklist completo
CREATE TYPE "MotivoJustificacionTecnica" AS ENUM (
  'CLIENTE_AUSENTE',
  'CLIENTE_NO_PERMITE_INGRESO',
  'DIRECCION_INCORRECTA',
  'SIN_ACCESO_INFRAESTRUCTURA',
  'FALTA_MATERIALES',
  'DANO_MAYOR_NO_PROGRAMADO',
  'RIESGO_TECNICO',
  'CONDICIONES_CLIMATICAS',
  'ESPERANDO_AUTORIZACION',
  'OTRO'
);

ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "cierrePorJustificacion" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "JustificacionTecnica" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "tecnicoId" TEXT NOT NULL,
  "motivo" "MotivoJustificacionTecnica" NOT NULL,
  "motivoOtro" TEXT,
  "justificacion" TEXT NOT NULL,
  "observaciones" TEXT,
  "fotoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revisadoPorId" TEXT,
  "revisadoEn" TIMESTAMP(3),
  "decision" TEXT,
  CONSTRAINT "JustificacionTecnica_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JustificacionTecnica_ticketId_createdAt_idx"
  ON "JustificacionTecnica"("ticketId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "JustificacionTecnica"
    ADD CONSTRAINT "JustificacionTecnica_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JustificacionTecnica"
    ADD CONSTRAINT "JustificacionTecnica_tecnicoId_fkey"
    FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JustificacionTecnica"
    ADD CONSTRAINT "JustificacionTecnica_revisadoPorId_fkey"
    FOREIGN KEY ("revisadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
