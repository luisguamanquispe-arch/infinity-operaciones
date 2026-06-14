-- Tipos de inventario y patch cord; detalle en material utilizado
CREATE TYPE "TipoInventario" AS ENUM ('CONSUMIBLE', 'PATCHCORD', 'EQUIPO');
CREATE TYPE "TipoPatchCord" AS ENUM ('APC_APC', 'APC_UPC', 'UPC_UPC');

ALTER TABLE "Inventario" ADD COLUMN "tipo" "TipoInventario" NOT NULL DEFAULT 'CONSUMIBLE';

UPDATE "Inventario"
SET "tipo" = 'PATCHCORD'
WHERE LOWER("nombre") LIKE '%patch%';

UPDATE "Inventario"
SET "tipo" = 'EQUIPO'
WHERE LOWER("nombre") LIKE '%onu%'
   OR LOWER("nombre") LIKE '%router%'
   OR LOWER("nombre") LIKE '%route%'
   OR LOWER("nombre") LIKE '%bridge%'
   OR LOWER("nombre") LIKE '%repetidor%';

ALTER TABLE "MaterialUtilizado" ADD COLUMN "serie" TEXT;
ALTER TABLE "MaterialUtilizado" ADD COLUMN "modelo" TEXT;
ALTER TABLE "MaterialUtilizado" ADD COLUMN "marca" TEXT;
ALTER TABLE "MaterialUtilizado" ADD COLUMN "tipoPatchCord" "TipoPatchCord";

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000bridge000001', 'Bridge', 'unidad', 20, 5, CURRENT_TIMESTAMP, 'EQUIPO'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Bridge');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000repet0000001', 'Repetidor', 'unidad', 20, 5, CURRENT_TIMESTAMP, 'EQUIPO'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Repetidor');

UPDATE "Inventario" SET "tipo" = 'EQUIPO' WHERE "nombre" IN ('Bridge', 'Repetidor');
