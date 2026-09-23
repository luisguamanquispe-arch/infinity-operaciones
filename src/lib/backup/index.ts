import { PARQUE_BACKUP_TABLES } from "@/lib/parque-automotor/backup-tablas";
import { prisma } from "@/lib/prisma";

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_KIND = "infinity-operaciones-full" as const;
export const RESTORE_CONFIRM_PHRASE = "RESTAURAR";

/** Orden de inserción (padres → hijos). El delete usa el orden inverso. */
export const BACKUP_TABLE_ORDER = [
  "Usuario",
  "Tecnico",
  "Cliente",
  "AppClienteCuenta",
  "AppClienteRefreshToken",
  "AppClienteSpeedTest",
  "AppClienteDeviceToken",
  "HistorialCliente",
  "Inventario",
  "Ticket",
  "TicketTecnico",
  "OrdenServicio",
  "Cronometro",
  "UbicacionGps",
  "Medicion",
  "Fotografia",
  "Firma",
  "MaterialUtilizado",
  "EvaluacionCliente",
  "EventoTicket",
  "NovedadTicket",
  "SrTicket",
  "SrAdjunto",
  "SrHistorial",
  "HdArticuloConocimiento",
  "HdConversacion",
  "HdMensaje",
  "HdAccionRemota",
  "HdEscalamiento",
  "HdSugerenciaIa",
  "HdSesionAgente",
  ...PARQUE_BACKUP_TABLES,
] as const;

export type BackupTableName = (typeof BACKUP_TABLE_ORDER)[number];

type Delegate = {
  findMany: (args?: { select?: Record<string, boolean> }) => Promise<unknown[]>;
  deleteMany: () => Promise<{ count: number }>;
  createMany: (args: { data: unknown[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
  count: () => Promise<number>;
};

function delegate(name: BackupTableName): Delegate {
  const map: Record<BackupTableName, Delegate> = {
    Usuario: prisma.usuario as unknown as Delegate,
    Tecnico: prisma.tecnico as unknown as Delegate,
    Cliente: prisma.cliente as unknown as Delegate,
    AppClienteCuenta: prisma.appClienteCuenta as unknown as Delegate,
    AppClienteRefreshToken: prisma.appClienteRefreshToken as unknown as Delegate,
    AppClienteSpeedTest: prisma.appClienteSpeedTest as unknown as Delegate,
    AppClienteDeviceToken: prisma.appClienteDeviceToken as unknown as Delegate,
    HistorialCliente: prisma.historialCliente as unknown as Delegate,
    Inventario: prisma.inventario as unknown as Delegate,
    Ticket: prisma.ticket as unknown as Delegate,
    TicketTecnico: prisma.ticketTecnico as unknown as Delegate,
    OrdenServicio: prisma.ordenServicio as unknown as Delegate,
    Cronometro: prisma.cronometro as unknown as Delegate,
    UbicacionGps: prisma.ubicacionGps as unknown as Delegate,
    Medicion: prisma.medicion as unknown as Delegate,
    Fotografia: prisma.fotografia as unknown as Delegate,
    Firma: prisma.firma as unknown as Delegate,
    MaterialUtilizado: prisma.materialUtilizado as unknown as Delegate,
    EvaluacionCliente: prisma.evaluacionCliente as unknown as Delegate,
    EventoTicket: prisma.eventoTicket as unknown as Delegate,
    NovedadTicket: prisma.novedadTicket as unknown as Delegate,
    SrTicket: prisma.srTicket as unknown as Delegate,
    SrAdjunto: prisma.srAdjunto as unknown as Delegate,
    SrHistorial: prisma.srHistorial as unknown as Delegate,
    HdArticuloConocimiento: prisma.hdArticuloConocimiento as unknown as Delegate,
    HdConversacion: prisma.hdConversacion as unknown as Delegate,
    HdMensaje: prisma.hdMensaje as unknown as Delegate,
    HdAccionRemota: prisma.hdAccionRemota as unknown as Delegate,
    HdEscalamiento: prisma.hdEscalamiento as unknown as Delegate,
    HdSugerenciaIa: prisma.hdSugerenciaIa as unknown as Delegate,
    HdSesionAgente: prisma.hdSesionAgente as unknown as Delegate,
    Vehiculo: prisma.vehiculo as unknown as Delegate,
    AsignacionVehiculo: prisma.asignacionVehiculo as unknown as Delegate,
    ActaVehiculo: prisma.actaVehiculo as unknown as Delegate,
    ActaVehiculoFoto: prisma.actaVehiculoFoto as unknown as Delegate,
    ActaVehiculoFirma: prisma.actaVehiculoFirma as unknown as Delegate,
    FotoVehiculo: prisma.fotoVehiculo as unknown as Delegate,
    LecturaKilometraje: prisma.lecturaKilometraje as unknown as Delegate,
    CargaCombustible: prisma.cargaCombustible as unknown as Delegate,
    InspeccionVehiculo: prisma.inspeccionVehiculo as unknown as Delegate,
    InspeccionVehiculoFoto: prisma.inspeccionVehiculoFoto as unknown as Delegate,
    MantenimientoVehiculo: prisma.mantenimientoVehiculo as unknown as Delegate,
    MantenimientoVehiculoFoto: prisma.mantenimientoVehiculoFoto as unknown as Delegate,
    NovedadVehiculo: prisma.novedadVehiculo as unknown as Delegate,
    NovedadVehiculoFoto: prisma.novedadVehiculoFoto as unknown as Delegate,
    DocumentoVehiculo: prisma.documentoVehiculo as unknown as Delegate,
    VehiculoAuditoria: prisma.vehiculoAuditoria as unknown as Delegate,
    UsoVehiculoTicket: prisma.usoVehiculoTicket as unknown as Delegate,
  };
  return map[name];
}

export function getTableDelegate(name: BackupTableName): Delegate {
  return delegate(name);
}

/** Serializa Date y tipos Prisma a JSON seguro. */
export function toJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return { __type: "Buffer", base64: value.toString("base64") };
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") {
    const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
    if (ctor === "Decimal" || typeof (value as { toFixed?: unknown }).toFixed === "function") {
      return Number(value as unknown as number);
    }
    if (Array.isArray(value)) return value.map(toJsonSafe);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toJsonSafe(v);
    }
    return out;
  }
  return value;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/** Revierte ISO strings a Date para createMany de Prisma. */
export function reviveValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" && ISO_DATE.test(value)) return new Date(value);
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    if (o.__type === "Buffer" && typeof o.base64 === "string") {
      return Buffer.from(o.base64, "base64");
    }
    if (Array.isArray(value)) return value.map(reviveValue);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = reviveValue(v);
    }
    return out;
  }
  return value;
}

export type BackupPayload = {
  formatVersion: number;
  kind: typeof BACKUP_KIND;
  exportedAt: string;
  app: "infinity-operaciones";
  includeMedia: boolean;
  counts: Record<string, number>;
  tables: Record<string, unknown[]>;
};

export type BackupStatus = {
  tables: Record<string, number>;
  totalRows: number;
  estimatedHeavy: boolean;
};

export async function getBackupStatus(): Promise<BackupStatus> {
  const tables: Record<string, number> = {};
  let totalRows = 0;
  for (const name of BACKUP_TABLE_ORDER) {
    const n = await getTableDelegate(name).count();
    tables[name] = n;
    totalRows += n;
  }
  const mediaRows = (tables.Fotografia ?? 0) + (tables.Firma ?? 0);
  return {
    tables,
    totalRows,
    estimatedHeavy: mediaRows > 200 || totalRows > 20000,
  };
}

export async function buildBackup(opts: { includeMedia?: boolean } = {}): Promise<BackupPayload> {
  const includeMedia = opts.includeMedia !== false;
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const name of BACKUP_TABLE_ORDER) {
    let rows: unknown[];
    if (!includeMedia && name === "Fotografia") {
      rows = await prisma.fotografia.findMany({
        select: {
          id: true,
          ordenId: true,
          tipo: true,
          url: true,
          lat: true,
          lng: true,
          tomadaEn: true,
          // imagenData omitido
        },
      });
    } else if (!includeMedia && name === "Firma") {
      rows = await prisma.firma.findMany({
        select: {
          id: true,
          ordenId: true,
          nombreCliente: true,
          cedula: true,
          imagenUrl: true,
          firmadoEn: true,
          lat: true,
          lng: true,
          aceptacionCondiciones: true,
          textoAceptacion: true,
          aceptadoEn: true,
        },
      });
    } else {
      rows = await getTableDelegate(name).findMany();
    }
    const safe = toJsonSafe(rows) as unknown[];
    tables[name] = safe;
    counts[name] = safe.length;
  }

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    kind: BACKUP_KIND,
    exportedAt: new Date().toISOString(),
    app: "infinity-operaciones",
    includeMedia,
    counts,
    tables,
  };
}

export type RestoreResult = {
  mode: "replace";
  deleted: Record<string, number>;
  inserted: Record<string, number>;
  warnings: string[];
};

function assertValidPayload(raw: unknown): BackupPayload {
  if (!raw || typeof raw !== "object") throw new Error("Archivo de backup inválido");
  const p = raw as BackupPayload;
  if (p.kind !== BACKUP_KIND) {
    throw new Error(`Tipo de backup no soportado: ${String(p.kind)}`);
  }
  if (p.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Versión de formato no soportada: ${p.formatVersion} (esperada ${BACKUP_FORMAT_VERSION})`
    );
  }
  if (!p.tables || typeof p.tables !== "object") {
    throw new Error("Backup sin tablas");
  }
  return p;
}

const CHUNK = 200;

async function createManyChunked(name: BackupTableName, rows: unknown[]) {
  const d = getTableDelegate(name);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK).map((r) => reviveValue(r)) as unknown[];
    const res = await d.createMany({ data: slice, skipDuplicates: true });
    inserted += res.count;
  }
  return inserted;
}

/**
 * Restaura un backup completo.
 * mode replace: vacía tablas en orden inverso y vuelve a insertar (destruye datos actuales).
 */
export async function restoreBackup(
  raw: unknown,
  opts: { confirmPhrase: string }
): Promise<RestoreResult> {
  if (opts.confirmPhrase !== RESTORE_CONFIRM_PHRASE) {
    throw new Error(`Debe confirmar con la frase exacta: ${RESTORE_CONFIRM_PHRASE}`);
  }

  const payload = assertValidPayload(raw);
  const warnings: string[] = [];
  const deleted: Record<string, number> = {};
  const inserted: Record<string, number> = {};

  // Borrar hijos → padres
  const deleteOrder = [...BACKUP_TABLE_ORDER].reverse();
  for (const name of deleteOrder) {
    const res = await getTableDelegate(name).deleteMany();
    deleted[name] = res.count;
  }

  for (const name of BACKUP_TABLE_ORDER) {
    const rows = payload.tables[name];
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      inserted[name] = 0;
      continue;
    }
    try {
      inserted[name] = await createManyChunked(name, rows);
      if (inserted[name] < rows.length) {
        warnings.push(
          `${name}: insertados ${inserted[name]} de ${rows.length} (posibles duplicados omitidos)`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`${name}: error al insertar — ${msg}`);
      throw new Error(`Fallo al restaurar tabla ${name}: ${msg}`);
    }
  }

  if (!payload.includeMedia) {
    warnings.push(
      "El backup no incluye imagenData de fotos/firmas; las URLs se conservan si apuntan a almacenamiento externo."
    );
  }

  return { mode: "replace", deleted, inserted, warnings };
}
