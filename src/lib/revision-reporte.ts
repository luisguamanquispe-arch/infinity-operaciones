import type { EstadoRevision, PrismaClient } from "@prisma/client";

export const ESTADOS_REVISION = [
  "PENDIENTE_REVISION",
  "DEVUELTO_CORRECCION",
  "CORREGIDO",
  "APROBADO",
] as const satisfies readonly EstadoRevision[];

export const ESTADO_REVISION_LABELS: Record<EstadoRevision, string> = {
  PENDIENTE_REVISION: "Pendiente de Revisión",
  DEVUELTO_CORRECCION: "Devuelto para Corrección",
  CORREGIDO: "Corregido",
  APROBADO: "Aprobado",
};

export const MOTIVOS_DEVOLUCION = [
  "Faltan fotografías",
  "Descripción incompleta",
  "Faltan materiales",
  "Información incorrecta",
  "Otro",
] as const;

export function puedeRevisarReportes(rol: string | null | undefined): boolean {
  return rol === "SUPERVISOR" || rol === "ADMIN";
}

export function reporteEnColaRevision(
  estadoRevision: EstadoRevision | null | undefined
): boolean {
  return (
    estadoRevision === "PENDIENTE_REVISION" || estadoRevision === "CORREGIDO"
  );
}

/**
 * Supervisor puede devolver:
 * - Pendiente de revisión / Corregido (flujo nuevo)
 * - Aprobado (reabrir calidad)
 * - Legado sin estadoRevision si el ticket ya está FINALIZADO o CERRADO
 */
export function reportePuedeDevolverse(
  estadoRevision: EstadoRevision | null | undefined,
  estadoTicket?: string | null
): boolean {
  if (estadoRevision === "DEVUELTO_CORRECCION") return false;
  if (reporteEnColaRevision(estadoRevision)) return true;
  if (estadoRevision === "APROBADO") return true;
  if (
    (estadoRevision == null || estadoRevision === undefined) &&
    (estadoTicket === "CERRADO" || estadoTicket === "FINALIZADO")
  ) {
    return true;
  }
  return false;
}

export function reportePuedeAprobarse(
  estadoRevision: EstadoRevision | null | undefined
): boolean {
  return reporteEnColaRevision(estadoRevision);
}

export function reporteDevuelto(
  estadoRevision: EstadoRevision | null | undefined
): boolean {
  return estadoRevision === "DEVUELTO_CORRECCION";
}

export function reporteAprobado(
  estadoRevision: EstadoRevision | null | undefined
): boolean {
  return estadoRevision === "APROBADO";
}

type PrismaTx = PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export async function registrarRevisionHistorial(
  db: PrismaTx,
  params: {
    ticketId: string;
    accion: string;
    estadoAnterior: EstadoRevision | null;
    estadoNuevo: EstadoRevision;
    motivo?: string | null;
    observaciones?: string | null;
    usuarioId?: string | null;
    usuarioNombre: string;
    tecnicoId?: string | null;
  }
) {
  await db.revisionHistorial.create({
    data: {
      ticketId: params.ticketId,
      accion: params.accion,
      estadoAnterior: params.estadoAnterior,
      estadoNuevo: params.estadoNuevo,
      motivo: params.motivo?.trim() || null,
      observaciones: params.observaciones?.trim() || null,
      usuarioId: params.usuarioId || null,
      usuarioNombre: params.usuarioNombre,
      tecnicoId: params.tecnicoId || null,
    },
  });
}
