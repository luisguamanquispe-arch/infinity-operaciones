export const COMENTARIO_MAX = 1000;
export const MUESTRA_MINIMA = 10;
export const DIAS_VIGENCIA_ENCUESTA = 30;
export const SOLUCIONES = ["COMPLETAMENTE", "PARCIALMENTE", "NO"] as const;
export type SolucionValor = (typeof SOLUCIONES)[number];

export const ESTADOS_ENCUESTA = [
  "PENDING",
  "SENT",
  "OPENED",
  "ANSWERED",
  "EXPIRED",
  "CANCELLED",
] as const;

/** Tipos reales de Ticket. REPARACIÓN y MANTENIMIENTO no existen en TipoTrabajo. */
export const TIPOS_SERVICIO_ENCUESTA = [
  "INSTALACION",
  "SOPORTE",
  "INFRAESTRUCTURA",
  "MIGRACION",
  "RECONEXION",
  "RETIRO",
  "CORTE",
] as const;
