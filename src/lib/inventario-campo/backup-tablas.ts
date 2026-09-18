/** Orden de inserción (padres → hijos) tablas inventario de campo. */
export const INVENTARIO_CAMPO_BACKUP_TABLES = [
  "MaterialCategory",
  "Warehouse",
  "WarehouseStock",
  "SerializedAsset",
  "SerializedAssetHistorial",
  "MaterialRequest",
  "MaterialRequestItem",
  "MaterialDelivery",
  "MaterialDeliveryItem",
  "MaterialDamageReport",
  "InventoryMovement",
  "InventoryReconciliation",
  "InventoryAuditLog",
] as const;

export type InventarioCampoBackupTableName =
  (typeof INVENTARIO_CAMPO_BACKUP_TABLES)[number];
