/** Orden de inserción (padres → hijos) de tablas del parque automotor. */
export const PARQUE_BACKUP_TABLES = [
  "Vehiculo",
  "AsignacionVehiculo",
  "ActaVehiculo",
  "ActaVehiculoFoto",
  "ActaVehiculoFirma",
  "FotoVehiculo",
  "LecturaKilometraje",
  "CargaCombustible",
  "InspeccionVehiculo",
  "InspeccionVehiculoFoto",
  "MantenimientoVehiculo",
  "MantenimientoVehiculoFoto",
  "NovedadVehiculo",
  "NovedadVehiculoFoto",
  "DocumentoVehiculo",
  "VehiculoAuditoria",
  "UsoVehiculoTicket",
] as const;

export type ParqueBackupTableName = (typeof PARQUE_BACKUP_TABLES)[number];

export function backupIncluyeParqueCompleto(
  order: readonly string[]
): { ok: true } | { ok: false; faltantes: string[] } {
  const faltantes = PARQUE_BACKUP_TABLES.filter((t) => !order.includes(t));
  if (faltantes.length > 0) return { ok: false, faltantes: [...faltantes] };
  let last = -1;
  for (const t of PARQUE_BACKUP_TABLES) {
    const i = order.indexOf(t);
    if (i < last) {
      return { ok: false, faltantes: [t] };
    }
    last = i;
  }
  return { ok: true };
}
