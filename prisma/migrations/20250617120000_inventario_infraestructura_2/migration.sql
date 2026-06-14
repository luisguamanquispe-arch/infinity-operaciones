-- Más materiales de infraestructura (amarras, herrajes, fibra droop, etc.)
INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000amarras001', 'Amarras', 'unidad', 2000, 200, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Amarras');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000pinzas001', 'Pinzas', 'unidad', 50, 10, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Pinzas');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000ganchos01', 'Ganchos de abonados', 'unidad', 500, 80, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Ganchos de abonados');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000fibdroop1', 'Fibra Droop', 'm', 8000, 800, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Fibra Droop');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000cintas01', 'Cintas metalicas', 'unidad', 300, 40, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Cintas metalicas');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000herrajA1', 'Herrajes tipo A', 'unidad', 400, 60, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Herrajes tipo A');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000brazos001', 'Brazos', 'unidad', 200, 30, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Brazos');

INSERT INTO "Inventario" ("id", "nombre", "unidad", "stock", "stockMin", "createdAt", "tipo")
SELECT 'clmat000otros001', 'Otros', 'unidad', 100, 0, CURRENT_TIMESTAMP, 'CONSUMIBLE'
WHERE NOT EXISTS (SELECT 1 FROM "Inventario" WHERE "nombre" = 'Otros');
