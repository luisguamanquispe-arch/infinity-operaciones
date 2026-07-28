import type { TipoTrabajo } from "@prisma/client";

/** Tipos de ticket ST-* que gerencia puede listar y eliminar (no infraestructura). */
export const TIPOS_ELIMINABLES_GERENCIA: TipoTrabajo[] = [
  "SOPORTE",
  "INSTALACION",
  "RECONEXION",
  "CORTE",
  "MIGRACION",
  "RETIRO",
];

export const ESTADOS_ACTIVOS_TICKET = ["PENDIENTE", "LEIDO", "EN_PROCESO"] as const;

export function ticketEliminableEnGerencia(tipo: TipoTrabajo): boolean {
  return TIPOS_ELIMINABLES_GERENCIA.includes(tipo);
}

/** Código tipo ST-1002 o INF-1001 */
export function esCodigoTicketExacto(q: string): boolean {
  return /^(ST|INF)-\d+$/i.test(q.trim());
}
