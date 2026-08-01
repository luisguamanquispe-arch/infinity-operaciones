-- Soporte de Infraestructura (reemplazo UI Ticket INF-*): enums, campos, historial, comentarios

DO $$ BEGIN
  CREATE TYPE "SiTipoTrabajo" AS ENUM (
    'CORTE_FIBRA',
    'EMPALME',
    'CAMBIO_NAP',
    'CAMBIO_CTO',
    'CAMBIO_SPLITTER',
    'CAMBIO_ODF',
    'CAMBIO_POSTE',
    'CAMBIO_CABLE',
    'REUBICACION',
    'MANTENIMIENTO_PREVENTIVO',
    'MANTENIMIENTO_CORRECTIVO',
    'EXPANSION_RED',
    'OTRO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SiResultado" AS ENUM (
    'REPARADO',
    'REPARADO_PARCIAL',
    'PENDIENTE',
    'REQUIERE_NUEVA_INTERVENCION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "siTipoTrabajo" "SiTipoTrabajo";
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "siTipoTrabajoOtro" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "provincia" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "canton" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "parroquia" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "sectorInfra" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "direccionInfra" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "referenciaInfra" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "latInfra" DOUBLE PRECISION;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "lngInfra" DOUBLE PRECISION;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "diagnosticoInfra" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "trabajoRealizadoInfra" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "resultadoInfra" "SiResultado";
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "observacionesInfra" TEXT;

CREATE INDEX IF NOT EXISTS "Ticket_tipo_estado_idx" ON "Ticket"("tipo", "estado");
CREATE INDEX IF NOT EXISTS "Ticket_siTipoTrabajo_idx" ON "Ticket"("siTipoTrabajo");

-- Migrar motivos legacy → siTipoTrabajo
UPDATE "Ticket"
SET "siTipoTrabajo" = CASE "motivoInfraestructura"::text
  WHEN 'CORTE_FIBRA' THEN 'CORTE_FIBRA'::"SiTipoTrabajo"
  WHEN 'CORTE_ELECTRICO' THEN 'MANTENIMIENTO_CORRECTIVO'::"SiTipoTrabajo"
  WHEN 'CONFIG_NODO' THEN 'MANTENIMIENTO_CORRECTIVO'::"SiTipoTrabajo"
  WHEN 'ACTUALIZACION' THEN 'MANTENIMIENTO_CORRECTIVO'::"SiTipoTrabajo"
  ELSE "siTipoTrabajo"
END
WHERE "tipo" = 'INFRAESTRUCTURA' AND "siTipoTrabajo" IS NULL AND "motivoInfraestructura" IS NOT NULL;

UPDATE "Ticket"
SET "siTipoTrabajoOtro" = COALESCE("siTipoTrabajoOtro", 'Migrado: ' || "motivoInfraestructura"::text)
WHERE "tipo" = 'INFRAESTRUCTURA'
  AND "motivoInfraestructura" IS NOT NULL
  AND "motivoInfraestructura"::text <> 'CORTE_FIBRA'
  AND "siTipoTrabajoOtro" IS NULL;

-- Ubicación aproximada desde zona/nodo legacy
UPDATE "Ticket"
SET
  "sectorInfra" = COALESCE("sectorInfra", "zonaInfra"),
  "direccionInfra" = COALESCE("direccionInfra", "nodoAfectado"),
  "provincia" = COALESCE("provincia", 'TUNGURAHUA'),
  "canton" = COALESCE("canton", 'AMBATO')
WHERE "tipo" = 'INFRAESTRUCTURA';

CREATE TABLE IF NOT EXISTS "SiHistorial" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usuarioId" TEXT,
  "usuarioNombre" TEXT NOT NULL,
  "accion" TEXT NOT NULL,
  "detalle" TEXT,
  CONSTRAINT "SiHistorial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SiHistorial_ticketId_fecha_idx" ON "SiHistorial"("ticketId", "fecha");
DO $$ BEGIN
  ALTER TABLE "SiHistorial"
    ADD CONSTRAINT "SiHistorial_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "SiHistorial"
    ADD CONSTRAINT "SiHistorial_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SiComentario" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "tecnicoId" TEXT NOT NULL,
  "texto" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiComentario_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SiComentario_ticketId_createdAt_idx" ON "SiComentario"("ticketId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "SiComentario"
    ADD CONSTRAINT "SiComentario_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "SiComentario"
    ADD CONSTRAINT "SiComentario_tecnicoId_fkey"
    FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Historial inicial para tickets INF existentes
INSERT INTO "SiHistorial" ("id", "ticketId", "fecha", "usuarioId", "usuarioNombre", "accion", "detalle")
SELECT
  md5(random()::text || clock_timestamp()::text || t."id"),
  t."id",
  t."createdAt",
  NULL,
  'Sistema',
  'MIGRACION_SOPORTE_INFRA',
  'Migración a Soporte de Infraestructura'
FROM "Ticket" t
WHERE t."tipo" = 'INFRAESTRUCTURA'
  AND NOT EXISTS (SELECT 1 FROM "SiHistorial" h WHERE h."ticketId" = t."id");
