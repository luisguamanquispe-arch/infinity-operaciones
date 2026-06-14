-- Materiales adicionales para soporte de infraestructura
INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000mangas00001', 'Mangas', 'unidad', 300, 50, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Mangas');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000fibadss001', 'Fibra ADSS', 'm', 10000, 1000, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Fibra ADSS');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000fibasus01', 'Fibra ASUS', 'm', 5000, 500, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Fibra ASUS');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000cajanap01', 'Caja NAP', 'unidad', 60, 10, CURRENT_TIMESTAMP, 'EQUIPO'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Caja NAP');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000splitter1', 'Splitter', 'unidad', 80, 15, CURRENT_TIMESTAMP, 'EQUIPO'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Splitter');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000rbmikrot1', 'RB Mikrotik', 'unidad', 25, 5, CURRENT_TIMESTAMP, 'EQUIPO'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'RB Mikrotik');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000roseta001', 'Roseta', 'unidad', 400, 50, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Roseta');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000pigtailupc', 'Pigtail UPC', 'unidad', 200, 30, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Pigtail UPC');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000pigtailapc', 'Pigtail APC', 'unidad', 200, 30, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Pigtail APC');

UPDATE "Inventario" SET "tipo" = 'EQUIPO' WHERE "nombre" IN ('Caja NAP', 'Splitter', 'RB Mikrotik');
