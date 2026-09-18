-- Inventario de campo: rol BODEGA, catálogo extendido, bodegas, kardex, solicitudes, entregas, seriales

ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'BODEGA';

CREATE TYPE "UnidadInventarioCampo" AS ENUM ('UNIDAD', 'METRO', 'ROLLO', 'CAJA', 'PAQUETE', 'LITRO', 'KILOGRAMO', 'JUEGO');
CREATE TYPE "EstadoSolicitudMaterial" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'REJECTED', 'RESERVED', 'PREPARED', 'DELIVERED', 'IN_USE', 'PENDING_RECONCILIATION', 'RECONCILED', 'CANCELLED', 'CLOSED');
CREATE TYPE "TipoTrabajoMaterial" AS ENUM ('DOMICILIARY_INSTALLATION', 'DOMICILIARY_REPAIR', 'INFRASTRUCTURE_INSTALLATION', 'INFRASTRUCTURE_MAINTENANCE', 'MIGRATION', 'OTHER');
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'RESERVATION', 'RESERVATION_RELEASE', 'DELIVERY', 'CONSUMPTION', 'RETURN', 'DAMAGE', 'LOSS', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'INSTALLATION', 'RECOVERY', 'REVERSAL');
CREATE TYPE "EstadoActivoSerializado" AS ENUM ('AVAILABLE', 'RESERVED', 'ASSIGNED', 'INSTALLED', 'RETURNED', 'DAMAGED', 'LOST', 'IN_REPAIR', 'RETIRED');
CREATE TYPE "EstadoDanoMaterial" AS ENUM ('REPORTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "PrioridadMaterial" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

CREATE TABLE "MaterialCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaterialCategory_code_key" ON "MaterialCategory"("code");

ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "maximumStock" DOUBLE PRECISION;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "lastPurchaseCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "isSerialized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "requiresLot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "unidadCampo" "UnidadInventarioCampo" NOT NULL DEFAULT 'UNIDAD';
ALTER TABLE "Inventario" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Inventario_code_idx" ON "Inventario"("code");
CREATE INDEX IF NOT EXISTS "Inventario_categoryId_idx" ON "Inventario"("categoryId");
CREATE INDEX IF NOT EXISTS "Inventario_isActive_idx" ON "Inventario"("isActive");

CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

CREATE TABLE "WarehouseStock" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "physicalQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assignedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WarehouseStock_warehouseId_inventarioId_key" ON "WarehouseStock"("warehouseId", "inventarioId");
CREATE INDEX "WarehouseStock_inventarioId_idx" ON "WarehouseStock"("inventarioId");

CREATE TABLE "SerializedAsset" (
    "id" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "macAddress" TEXT,
    "imei" TEXT,
    "status" "EstadoActivoSerializado" NOT NULL DEFAULT 'AVAILABLE',
    "warehouseId" TEXT,
    "assignedTechnicianId" TEXT,
    "ticketId" TEXT,
    "clienteId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SerializedAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SerializedAsset_inventarioId_serialNumber_key" ON "SerializedAsset"("inventarioId", "serialNumber");
CREATE INDEX "SerializedAsset_status_idx" ON "SerializedAsset"("status");
CREATE INDEX "SerializedAsset_ticketId_idx" ON "SerializedAsset"("ticketId");
CREATE INDEX "SerializedAsset_assignedTechnicianId_idx" ON "SerializedAsset"("assignedTechnicianId");

CREATE TABLE "SerializedAssetHistorial" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromStatus" "EstadoActivoSerializado",
    "toStatus" "EstadoActivoSerializado" NOT NULL,
    "usuarioId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SerializedAssetHistorial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SerializedAssetHistorial_assetId_createdAt_idx" ON "SerializedAssetHistorial"("assetId", "createdAt");

CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "movementNumber" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "serialId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "movementType" "TipoMovimientoInventario" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ticketId" TEXT,
    "tecnicoId" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "performedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryMovement_movementNumber_key" ON "InventoryMovement"("movementNumber");
CREATE INDEX "InventoryMovement_inventarioId_createdAt_idx" ON "InventoryMovement"("inventarioId", "createdAt");
CREATE INDEX "InventoryMovement_warehouseId_createdAt_idx" ON "InventoryMovement"("warehouseId", "createdAt");
CREATE INDEX "InventoryMovement_ticketId_idx" ON "InventoryMovement"("ticketId");
CREATE INDEX "InventoryMovement_movementType_createdAt_idx" ON "InventoryMovement"("movementType", "createdAt");
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType", "referenceId");

CREATE TABLE "MaterialRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "workType" "TipoTrabajoMaterial" NOT NULL DEFAULT 'OTHER',
    "priority" "PrioridadMaterial" NOT NULL DEFAULT 'MEDIA',
    "status" "EstadoSolicitudMaterial" NOT NULL DEFAULT 'DRAFT',
    "justification" TEXT,
    "requestedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaterialRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaterialRequest_requestNumber_key" ON "MaterialRequest"("requestNumber");
CREATE INDEX "MaterialRequest_ticketId_createdAt_idx" ON "MaterialRequest"("ticketId", "createdAt");
CREATE INDEX "MaterialRequest_tecnicoId_status_idx" ON "MaterialRequest"("tecnicoId", "status");
CREATE INDEX "MaterialRequest_status_createdAt_idx" ON "MaterialRequest"("status", "createdAt");

CREATE TABLE "MaterialRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "requestedQty" DOUBLE PRECISION NOT NULL,
    "approvedQty" DOUBLE PRECISION,
    "notes" TEXT,
    CONSTRAINT "MaterialRequestItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaterialRequestItem_requestId_idx" ON "MaterialRequestItem"("requestId");
CREATE INDEX "MaterialRequestItem_inventarioId_idx" ON "MaterialRequestItem"("inventarioId");

CREATE TABLE "MaterialDelivery" (
    "id" TEXT NOT NULL,
    "deliveryNumber" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "deliveredById" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "confirmationNotes" TEXT,
    "differenceReported" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaterialDelivery_deliveryNumber_key" ON "MaterialDelivery"("deliveryNumber");
CREATE INDEX "MaterialDelivery_ticketId_deliveredAt_idx" ON "MaterialDelivery"("ticketId", "deliveredAt");
CREATE INDEX "MaterialDelivery_requestId_idx" ON "MaterialDelivery"("requestId");
CREATE INDEX "MaterialDelivery_tecnicoId_idx" ON "MaterialDelivery"("tecnicoId");

CREATE TABLE "MaterialDeliveryItem" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "deliveredQty" DOUBLE PRECISION NOT NULL,
    "usedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "damagedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lostQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lotNumber" TEXT,
    "serialAssetId" TEXT,
    "notes" TEXT,
    CONSTRAINT "MaterialDeliveryItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaterialDeliveryItem_deliveryId_idx" ON "MaterialDeliveryItem"("deliveryId");
CREATE INDEX "MaterialDeliveryItem_inventarioId_idx" ON "MaterialDeliveryItem"("inventarioId");

CREATE TABLE "MaterialDamageReport" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT,
    "ticketId" TEXT NOT NULL,
    "tecnicoId" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "photoData" TEXT,
    "status" "EstadoDanoMaterial" NOT NULL DEFAULT 'REPORTED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialDamageReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaterialDamageReport_ticketId_createdAt_idx" ON "MaterialDamageReport"("ticketId", "createdAt");
CREATE INDEX "MaterialDamageReport_status_idx" ON "MaterialDamageReport"("status");

CREATE TABLE "InventoryReconciliation" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "reconciledById" TEXT NOT NULL,
    "exceptionAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "exceptionReason" TEXT,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryReconciliation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InventoryReconciliation_ticketId_createdAt_idx" ON "InventoryReconciliation"("ticketId", "createdAt");
CREATE INDEX "InventoryReconciliation_requestId_idx" ON "InventoryReconciliation"("requestId");

CREATE TABLE "InventoryAuditLog" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "ticketId" TEXT,
    "motivo" TEXT,
    "valorAnterior" TEXT,
    "valorNuevo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InventoryAuditLog_entidad_registroId_idx" ON "InventoryAuditLog"("entidad", "registroId");
CREATE INDEX "InventoryAuditLog_ticketId_createdAt_idx" ON "InventoryAuditLog"("ticketId", "createdAt");
CREATE INDEX "InventoryAuditLog_createdAt_idx" ON "InventoryAuditLog"("createdAt");

-- FKs
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MaterialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseStock" ADD CONSTRAINT "WarehouseStock_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "Inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SerializedAsset" ADD CONSTRAINT "SerializedAsset_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "Inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SerializedAsset" ADD CONSTRAINT "SerializedAsset_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SerializedAsset" ADD CONSTRAINT "SerializedAsset_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "Tecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SerializedAsset" ADD CONSTRAINT "SerializedAsset_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SerializedAsset" ADD CONSTRAINT "SerializedAsset_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SerializedAssetHistorial" ADD CONSTRAINT "SerializedAssetHistorial_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "SerializedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "Inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "SerializedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialRequest" ADD CONSTRAINT "MaterialRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialRequestItem" ADD CONSTRAINT "MaterialRequestItem_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "Inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialDelivery" ADD CONSTRAINT "MaterialDelivery_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialDelivery" ADD CONSTRAINT "MaterialDelivery_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialDelivery" ADD CONSTRAINT "MaterialDelivery_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialDelivery" ADD CONSTRAINT "MaterialDelivery_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialDelivery" ADD CONSTRAINT "MaterialDelivery_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialDeliveryItem" ADD CONSTRAINT "MaterialDeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "MaterialDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialDeliveryItem" ADD CONSTRAINT "MaterialDeliveryItem_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "Inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialDeliveryItem" ADD CONSTRAINT "MaterialDeliveryItem_serialAssetId_fkey" FOREIGN KEY ("serialAssetId") REFERENCES "SerializedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialDamageReport" ADD CONSTRAINT "MaterialDamageReport_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "MaterialDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaterialDamageReport" ADD CONSTRAINT "MaterialDamageReport_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialDamageReport" ADD CONSTRAINT "MaterialDamageReport_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "Tecnico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialDamageReport" ADD CONSTRAINT "MaterialDamageReport_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "Inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialDamageReport" ADD CONSTRAINT "MaterialDamageReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryReconciliation" ADD CONSTRAINT "InventoryReconciliation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaterialRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReconciliation" ADD CONSTRAINT "InventoryReconciliation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReconciliation" ADD CONSTRAINT "InventoryReconciliation_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryAuditLog" ADD CONSTRAINT "InventoryAuditLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed categorías + bodega central + stock desde Inventario.stock legacy
INSERT INTO "MaterialCategory" ("id", "code", "name", "description", "isActive", "createdAt") VALUES
('mcat_fibra', 'FIBRA', 'FIBRA ÓPTICA', NULL, true, CURRENT_TIMESTAMP),
('mcat_cable', 'CABLEADO', 'CABLEADO', NULL, true, CURRENT_TIMESTAMP),
('mcat_conn', 'CONECTORES', 'CONECTORES', NULL, true, CURRENT_TIMESTAMP),
('mcat_roseta', 'ROSETAS', 'ROSETAS', NULL, true, CURRENT_TIMESTAMP),
('mcat_patch', 'PATCH_CORD', 'PATCH CORD', NULL, true, CURRENT_TIMESTAMP),
('mcat_herraje', 'HERRAJES', 'HERREAJES', NULL, true, CURRENT_TIMESTAMP),
('mcat_canal', 'CANALIZACION', 'CANALIZACIÓN', NULL, true, CURRENT_TIMESTAMP),
('mcat_equipo', 'EQUIPOS', 'EQUIPOS', NULL, true, CURRENT_TIMESTAMP),
('mcat_herr', 'HERRAMIENTAS', 'HERRAMIENTAS', NULL, true, CURRENT_TIMESTAMP),
('mcat_infra', 'INFRA', 'MATERIALES DE INFRAESTRUCTURA', NULL, true, CURRENT_TIMESTAMP),
('mcat_otros', 'OTROS', 'OTROS', NULL, true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Warehouse" ("id", "code", "name", "description", "isActive", "createdAt", "updatedAt")
VALUES ('wh_central', 'CENTRAL', 'BODEGA CENTRAL', 'Bodega principal Infinity', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "WarehouseStock" ("id", "warehouseId", "inventarioId", "physicalQty", "reservedQty", "assignedQty", "updatedAt")
SELECT 'ws_' || i."id", 'wh_central', i."id", i."stock", 0, 0, CURRENT_TIMESTAMP
FROM "Inventario" i
WHERE NOT EXISTS (
  SELECT 1 FROM "WarehouseStock" ws WHERE ws."warehouseId" = 'wh_central' AND ws."inventarioId" = i."id"
);
