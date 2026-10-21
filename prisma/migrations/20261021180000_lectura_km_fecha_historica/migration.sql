-- Additive: fecha histórica, tipo de lectura y fuente en LecturaKilometraje.
-- Reversible: DROP COLUMN fecha/tipoLectura/fuente; DROP TYPE TipoLecturaKmVehiculo.
-- Backfill: fecha = createdAt (no cambia kilometraje ni kilometrajeActual).

CREATE TYPE "TipoLecturaKmVehiculo" AS ENUM ('REAL', 'ESTIMADA');

ALTER TABLE "LecturaKilometraje"
  ADD COLUMN "fecha" TIMESTAMP(3),
  ADD COLUMN "tipoLectura" "TipoLecturaKmVehiculo" NOT NULL DEFAULT 'REAL',
  ADD COLUMN "fuente" TEXT;

UPDATE "LecturaKilometraje"
SET "fecha" = "createdAt"
WHERE "fecha" IS NULL;

ALTER TABLE "LecturaKilometraje"
  ALTER COLUMN "fecha" SET NOT NULL,
  ALTER COLUMN "fecha" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "LecturaKilometraje_vehiculoId_fecha_idx"
  ON "LecturaKilometraje"("vehiculoId", "fecha");
