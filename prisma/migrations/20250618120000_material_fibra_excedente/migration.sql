-- Conector mecanico y excedente de fibra drop (>350 m) en material utilizado
INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000conmech01', 'Conector mecanico', 'unidad', 300, 40, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Conector mecanico');

ALTER TABLE "MaterialUtilizado" ADD COLUMN "excedenteMetros" DOUBLE PRECISION;
