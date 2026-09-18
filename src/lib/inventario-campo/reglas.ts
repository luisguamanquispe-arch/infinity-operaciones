import type { Rol } from "@prisma/client";

export function stockDisponible(opts: {
  physicalQty: number;
  reservedQty: number;
  assignedQty: number;
}): number {
  return opts.physicalQty - opts.reservedQty - opts.assignedQty;
}

/** Invariantes del módulo nuevo: buckets y disponible no negativos. */
export function validarBucketsStock(opts: {
  physicalQty: number;
  reservedQty: number;
  assignedQty: number;
}): { ok: true } | { ok: false; error: string } {
  if (opts.physicalQty < -1e-9) {
    return { ok: false, error: "physicalQty no puede ser negativo en el flujo de campo." };
  }
  if (opts.reservedQty < -1e-9) {
    return { ok: false, error: "reservedQty no puede ser negativo." };
  }
  if (opts.assignedQty < -1e-9) {
    return { ok: false, error: "assignedQty no puede ser negativo." };
  }
  if (stockDisponible(opts) < -1e-9) {
    return { ok: false, error: "availableQty no puede ser negativo." };
  }
  return { ok: true };
}

/** Al sembrar WarehouseStock desde Inventario.stock legacy, no arrastrar negativos al módulo nuevo. */
export function physicalQtyDesdeLegacy(stockLegacy: number): number {
  if (!Number.isFinite(stockLegacy)) return 0;
  return Math.max(0, stockLegacy);
}

export function solicitudPuedePrepararse(status: string): boolean {
  return status === "RESERVED" || status === "APPROVED";
}

export function puedeGestionarCatalogo(rol: Rol | string): boolean {
  return rol === "ADMIN";
}

export function puedeSolicitarMaterial(rol: Rol | string): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR";
}

export function puedeAprobarMaterial(rol: Rol | string): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR";
}

export function puedeOperarBodega(rol: Rol | string): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR" || rol === "BODEGA";
}

export function puedeConciliarMaterial(rol: Rol | string): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR";
}

export function puedeAjustarInventario(rol: Rol | string): boolean {
  return rol === "ADMIN";
}

export function tecnicoPuedeUsarInventarioCampo(rol: Rol | string): boolean {
  return rol === "TECNICO";
}

export function validarCantidadPositiva(
  qty: number
): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, error: "La cantidad debe ser mayor a cero." };
  }
  return { ok: true };
}

export function validarReserva(opts: {
  disponible: number;
  cantidad: number;
}): { ok: true } | { ok: false; error: string; status: number } {
  const v = validarCantidadPositiva(opts.cantidad);
  if (!v.ok) return { ok: false, error: v.error, status: 400 };
  if (opts.cantidad > opts.disponible + 1e-9) {
    return {
      ok: false,
      error: `Stock insuficiente. Disponible: ${opts.disponible}.`,
      status: 409,
    };
  }
  return { ok: true };
}

export function validarConciliacionItem(opts: {
  deliveredQty: number;
  usedQty: number;
  returnedQty: number;
  damagedQty: number;
  lostQty: number;
}): { ok: true; diferencia: number } | { ok: false; error: string; diferencia: number } {
  const reporte = validarReporteUsoItem(opts);
  if (!reporte.ok) {
    return { ok: false, error: reporte.error, diferencia: reporte.diferencia };
  }
  const suma =
    opts.usedQty + opts.returnedQty + opts.damagedQty + opts.lostQty;
  const diferencia = opts.deliveredQty - suma;
  if (Math.abs(diferencia) > 1e-6) {
    return {
      ok: false,
      error: `Diferencia de inventario: entregado ${opts.deliveredQty}, contabilizado ${suma}, diferencia ${diferencia}.`,
      diferencia,
    };
  }
  return { ok: true, diferencia: 0 };
}

/** Validación al reportar uso: no negativos y suma ≤ entregado (cuadratura exacta es en conciliación). */
export function validarReporteUsoItem(opts: {
  deliveredQty: number;
  usedQty: number;
  returnedQty: number;
  damagedQty: number;
  lostQty: number;
}): { ok: true; diferencia: number } | { ok: false; error: string; diferencia: number; status: number } {
  const { deliveredQty, usedQty, returnedQty, damagedQty, lostQty } = opts;
  for (const [label, n] of [
    ["utilizado", usedQty],
    ["devuelto", returnedQty],
    ["dañado", damagedQty],
    ["perdido", lostQty],
  ] as const) {
    if (!Number.isFinite(n) || n < 0) {
      return {
        ok: false,
        error: `Cantidad ${label} inválida.`,
        diferencia: NaN,
        status: 400,
      };
    }
  }
  if (!Number.isFinite(deliveredQty) || deliveredQty < 0) {
    return {
      ok: false,
      error: "Cantidad entregada inválida.",
      diferencia: NaN,
      status: 400,
    };
  }
  const suma = usedQty + returnedQty + damagedQty + lostQty;
  if (suma > deliveredQty + 1e-9) {
    return {
      ok: false,
      error: `La suma de usado/devuelto/dañado/perdido (${suma}) supera lo entregado (${deliveredQty}).`,
      diferencia: deliveredQty - suma,
      status: 400,
    };
  }
  return { ok: true, diferencia: deliveredQty - suma };
}

const ESTADOS_SERIAL_ASIGNABLES = new Set(["AVAILABLE", "RETURNED"]);

/** Valida si un serial puede asignarse a una OT (puro; usable en tests). */
export function validarAsignacionSerial(opts: {
  status: string;
  ticketId: string | null | undefined;
  targetTicketId: string;
}): { ok: true } | { ok: false; error: string; status: number } {
  if (!ESTADOS_SERIAL_ASIGNABLES.has(opts.status)) {
    if (
      opts.ticketId &&
      opts.ticketId !== opts.targetTicketId &&
      ["ASSIGNED", "INSTALLED", "LOST", "DAMAGED", "RETIRED", "RESERVED", "IN_REPAIR"].includes(
        opts.status
      )
    ) {
      return {
        ok: false,
        error: "El equipo serializado ya está asignado a otra orden de trabajo.",
        status: 409,
      };
    }
    return {
      ok: false,
      error: `El equipo serializado no está disponible (estado ${opts.status}).`,
      status: 409,
    };
  }
  if (opts.ticketId && opts.ticketId !== opts.targetTicketId && opts.status === "ASSIGNED") {
    return {
      ok: false,
      error: "El equipo serializado ya está asignado a otra orden de trabajo.",
      status: 409,
    };
  }
  return { ok: true };
}

export function calcularCostoLinea(cantidad: number, unitCost: number): number {
  return Number((cantidad * unitCost).toFixed(4));
}

export function mapTipoTrabajoTicket(
  tipo: string | null | undefined
):
  | "DOMICILIARY_INSTALLATION"
  | "DOMICILIARY_REPAIR"
  | "INFRASTRUCTURE_INSTALLATION"
  | "INFRASTRUCTURE_MAINTENANCE"
  | "MIGRATION"
  | "OTHER" {
  switch (tipo) {
    case "INSTALACION":
      return "DOMICILIARY_INSTALLATION";
    case "SOPORTE":
    case "RECONEXION":
      return "DOMICILIARY_REPAIR";
    case "INFRAESTRUCTURA":
      return "INFRASTRUCTURE_MAINTENANCE";
    case "MIGRACION":
      return "MIGRATION";
    default:
      return "OTHER";
  }
}

export const ESTADOS_SOLICITUD_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  REQUESTED: "Solicitada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  RESERVED: "Reservada",
  PREPARED: "Preparada",
  DELIVERED: "Entregada",
  IN_USE: "En uso",
  PENDING_RECONCILIATION: "Pendiente conciliación",
  RECONCILED: "Conciliada",
  CANCELLED: "Cancelada",
  CLOSED: "Cerrada",
};

export function solicitudPuedeEditarse(status: string): boolean {
  return status === "DRAFT" || status === "REQUESTED";
}

export function solicitudPuedeAprobarse(status: string): boolean {
  return status === "REQUESTED" || status === "DRAFT";
}

export function solicitudPuedeEntregarse(status: string): boolean {
  return (
    status === "APPROVED" ||
    status === "RESERVED" ||
    status === "PREPARED"
  );
}

export function otTieneFlujoCampoActivo(status: string | null | undefined): boolean {
  if (!status) return false;
  return ![
    "DRAFT",
    "REJECTED",
    "CANCELLED",
    "CLOSED",
    "RECONCILED",
  ].includes(status);
}

/** Bloquea descuento legacy mientras la OT haya entrado al pipeline campo (incluye RECONCILED). */
export function otBloqueaDescuentoLegacy(status: string | null | undefined): boolean {
  if (!status) return false;
  return !["DRAFT", "REJECTED", "CANCELLED"].includes(status);
}
