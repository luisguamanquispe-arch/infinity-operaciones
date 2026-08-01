-- Infraestructura de Red v2: estados, tipos, resultado, equipos, historial, inventario

-- Estados
ALTER TYPE "IrEstadoReporte" ADD VALUE IF NOT EXISTS 'ASIGNADO';
ALTER TYPE "IrEstadoReporte" ADD VALUE IF NOT EXISTS 'CANCELADO';

-- Tipos de trabajo nuevos
ALTER TYPE "IrTipoTrabajo" ADD VALUE IF NOT EXISTS 'CAMBIO_ODF';
ALTER TYPE "IrTipoTrabajo" ADD VALUE IF NOT EXISTS 'CAMBIO_CAJA_PASO';
ALTER TYPE "IrTipoTrabajo" ADD VALUE IF NOT EXISTS 'CAMBIO_HERRAJES';
ALTER TYPE "IrTipoTrabajo" ADD VALUE IF NOT EXISTS 'CAMBIO_CABLE_TRONCAL';
ALTER TYPE "IrTipoTrabajo" ADD VALUE IF NOT EXISTS 'CAMBIO_CABLE_DISTRIBUCION';
ALTER TYPE "IrTipoTrabajo" ADD VALUE IF NOT EXISTS 'REUBICACION_RED';
ALTER TYPE "IrTipoTrabajo" ADD VALUE IF NOT EXISTS 'INSTALACION_TRONCAL';
ALTER TYPE "IrTipoTrabajo" ADD VALUE IF NOT EXISTS 'INSPECCION_RED';

-- Resultado
DO $$ BEGIN
  CREATE TYPE "IrResultado" AS ENUM (
    'REPARADO',
    'REPARADO_PARCIAL',
    'PENDIENTE_MATERIAL',
    'REQUIERE_NUEVA_INTERVENCION',
    'CANCELADO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Equipos
DO $$ BEGIN
  CREATE TYPE "IrEquipoTipo" AS ENUM (
    'FUSIONADORA',
    'OTDR',
    'POWER_METER',
    'VFL',
    'ESCALERA',
    'CAMIONETA',
    'OTRO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Columnas IrReporte
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "tiempoMinutos" INTEGER;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "nodo" TEXT;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "nap" TEXT;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "cto" TEXT;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "odf" TEXT;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "splitter" TEXT;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "manga" TEXT;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "cajaPaso" TEXT;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "tramoFibra" TEXT;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "cantidadHilos" INTEGER;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "longitudAfectadaM" DOUBLE PRECISION;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "kmRedIntervenida" DOUBLE PRECISION;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "clientesAfectadosN" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "trabajosRealizados" TEXT;
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "resultado" "IrResultado";
ALTER TABLE "IrReporte" ADD COLUMN IF NOT EXISTS "inventarioDescontado" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "IrReporte_tipoTrabajo_idx" ON "IrReporte"("tipoTrabajo");

-- Materiales: vínculo inventario
ALTER TABLE "IrMaterial" ADD COLUMN IF NOT EXISTS "inventarioId" TEXT;
CREATE INDEX IF NOT EXISTS "IrMaterial_inventarioId_idx" ON "IrMaterial"("inventarioId");

DO $$ BEGIN
  ALTER TABLE "IrMaterial"
    ADD CONSTRAINT "IrMaterial_inventarioId_fkey"
    FOREIGN KEY ("inventarioId") REFERENCES "Inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Equipos
CREATE TABLE IF NOT EXISTS "IrEquipo" (
  "id" TEXT NOT NULL,
  "reporteId" TEXT NOT NULL,
  "tipo" "IrEquipoTipo" NOT NULL,
  "detalle" TEXT,
  CONSTRAINT "IrEquipo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IrEquipo_reporteId_idx" ON "IrEquipo"("reporteId");
DO $$ BEGIN
  ALTER TABLE "IrEquipo"
    ADD CONSTRAINT "IrEquipo_reporteId_fkey"
    FOREIGN KEY ("reporteId") REFERENCES "IrReporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Participantes
CREATE TABLE IF NOT EXISTS "IrParticipante" (
  "id" TEXT NOT NULL,
  "reporteId" TEXT NOT NULL,
  "tecnicoId" TEXT NOT NULL,
  CONSTRAINT "IrParticipante_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IrParticipante_reporteId_tecnicoId_key" ON "IrParticipante"("reporteId", "tecnicoId");
CREATE INDEX IF NOT EXISTS "IrParticipante_reporteId_idx" ON "IrParticipante"("reporteId");
DO $$ BEGIN
  ALTER TABLE "IrParticipante"
    ADD CONSTRAINT "IrParticipante_reporteId_fkey"
    FOREIGN KEY ("reporteId") REFERENCES "IrReporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "IrParticipante"
    ADD CONSTRAINT "IrParticipante_tecnicoId_fkey"
    FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Clientes afectados
CREATE TABLE IF NOT EXISTS "IrClienteAfectado" (
  "id" TEXT NOT NULL,
  "reporteId" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "nota" TEXT,
  CONSTRAINT "IrClienteAfectado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IrClienteAfectado_reporteId_clienteId_key" ON "IrClienteAfectado"("reporteId", "clienteId");
CREATE INDEX IF NOT EXISTS "IrClienteAfectado_clienteId_idx" ON "IrClienteAfectado"("clienteId");
DO $$ BEGIN
  ALTER TABLE "IrClienteAfectado"
    ADD CONSTRAINT "IrClienteAfectado_reporteId_fkey"
    FOREIGN KEY ("reporteId") REFERENCES "IrReporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "IrClienteAfectado"
    ADD CONSTRAINT "IrClienteAfectado_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Historial append-only
CREATE TABLE IF NOT EXISTS "IrHistorial" (
  "id" TEXT NOT NULL,
  "reporteId" TEXT NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usuarioId" TEXT NOT NULL,
  "usuarioNombre" TEXT NOT NULL,
  "estado" "IrEstadoReporte" NOT NULL,
  "nota" TEXT,
  CONSTRAINT "IrHistorial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IrHistorial_reporteId_fecha_idx" ON "IrHistorial"("reporteId", "fecha");
DO $$ BEGIN
  ALTER TABLE "IrHistorial"
    ADD CONSTRAINT "IrHistorial_reporteId_fkey"
    FOREIGN KEY ("reporteId") REFERENCES "IrReporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "IrHistorial"
    ADD CONSTRAINT "IrHistorial_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Migrar datos históricos: tiempo y trabajos realizados
UPDATE "IrReporte"
SET
  "tiempoMinutos" = CASE
    WHEN "horaInicio" IS NOT NULL AND "horaFin" IS NOT NULL AND "horaFin" >= "horaInicio"
      THEN ROUND(EXTRACT(EPOCH FROM ("horaFin" - "horaInicio")) / 60)::INTEGER
    ELSE "tiempoMinutos"
  END,
  "trabajosRealizados" = COALESCE("trabajosRealizados", "descripcion")
WHERE "trabajosRealizados" IS NULL OR ("tiempoMinutos" IS NULL AND "horaInicio" IS NOT NULL AND "horaFin" IS NOT NULL);

-- Historial inicial para reportes existentes sin historial
INSERT INTO "IrHistorial" ("id", "reporteId", "fecha", "usuarioId", "usuarioNombre", "estado", "nota")
SELECT
  md5(random()::text || clock_timestamp()::text || r."id"),
  r."id",
  r."createdAt",
  r."creadoPorId",
  COALESCE(u."nombre", 'Sistema'),
  r."estado",
  'Migración módulo Infraestructura de Red v2'
FROM "IrReporte" r
LEFT JOIN "Usuario" u ON u."id" = r."creadoPorId"
WHERE NOT EXISTS (
  SELECT 1 FROM "IrHistorial" h WHERE h."reporteId" = r."id"
);
