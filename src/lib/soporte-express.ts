import type { ModalidadSoporte, TipoFoto, TrabajoExpress } from "@prisma/client";

export const MODALIDAD_SOPORTE_LABELS: Record<ModalidadSoporte, string> = {
  COMPLETO: "Soporte Completo",
  EXPRESS: "Soporte Express",
};

/**
 * Fotos obligatorias en Soporte Express (mín. 2):
 * 1 serie de equipos · 2 cliente satisfecho
 */
export const FOTOS_EXPRESS: TipoFoto[] = ["ONU", "CLIENTE_CONFORME"];

export const FOTOS_OBLIGATORIAS_EXPRESS: TipoFoto[] = [...FOTOS_EXPRESS];

export const FOTO_LABELS_EXPRESS: Record<string, string> = {
  ONU: "1. Serie de los equipos",
  CLIENTE_CONFORME: "2. Cliente satisfecho",
};

export const TRABAJO_EXPRESS_LABELS: Record<TrabajoExpress, string> = {
  INSTALACION_REPETIDOR_WIFI: "Instalación de repetidor WiFi",
  CAMBIO_PATCH_CORD: "Cambio de Patch Cord",
  CAMBIO_ROSETA: "Cambio de Roseta",
  CAMBIO_CONECTOR_RJ45: "Cambio de Conector RJ45",
  CAMBIO_FUENTE_PODER: "Cambio de Fuente de Poder",
  CAMBIO_CLAVE_WIFI: "Cambio de Clave WiFi",
  CAMBIO_NOMBRE_WIFI: "Cambio de Nombre WiFi",
  REINICIO_ROUTER: "Reinicio de Router",
  REINICIO_ONU: "Reinicio de ONU",
  CONFIGURACION_WIFI: "Configuración WiFi",
  CONFIGURACION_IPTV: "Configuración IPTV",
  CONFIGURACION_SMART_TV: "Configuración Smart TV",
  ACTUALIZACION_DATOS: "Actualización de Datos",
  ENTREGA_EQUIPO: "Entrega de Equipo",
  RETIRO_EQUIPO: "Retiro de Equipo",
  OTRO: "Otro",
};

export const TRABAJOS_EXPRESS = Object.keys(
  TRABAJO_EXPRESS_LABELS
) as TrabajoExpress[];

export function esSoporteExpress(
  ticket: { modalidadSoporte?: ModalidadSoporte | string | null } | null | undefined
): boolean {
  return ticket?.modalidadSoporte === "EXPRESS";
}

export function trabajoExpressTexto(
  trabajo: TrabajoExpress | null | undefined,
  otro?: string | null
): string {
  if (!trabajo) return "";
  if (trabajo === "OTRO" && otro?.trim()) return `Otro: ${otro.trim()}`;
  return TRABAJO_EXPRESS_LABELS[trabajo] ?? trabajo;
}
