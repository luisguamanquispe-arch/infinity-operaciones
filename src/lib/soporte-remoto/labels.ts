import type {
  SrEstado,
  SrResultado,
  SrTipoAdjunto,
  SrTipoSoporte,
} from "@prisma/client";

export type { SrEstado, SrResultado, SrTipoAdjunto, SrTipoSoporte };

export const SR_ESTADO_LABELS: Record<SrEstado, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  FINALIZADO: "Finalizado",
};

export const SR_TIPO_SOPORTE_LABELS: Record<SrTipoSoporte, string> = {
  CAMBIO_PASSWORD_WIFI: "Cambio de contraseña WiFi",
  CAMBIO_SSID: "Cambio de nombre de la red WiFi (SSID)",
  REINICIO_ROUTER: "Reinicio de Router",
  REINICIO_ONU: "Reinicio de ONU",
  REINICIO_PUERTO_OLT: "Reinicio de Puerto OLT",
  ACTUALIZACION_DATOS_CLIENTE: "Actualización de datos del cliente",
  CAMBIO_PLAN: "Cambio de plan",
  ACTIVACION_SERVICIO: "Activación del servicio",
  REACTIVACION_PAGO: "Reactivación por pago",
  SUSPENSION_SERVICIO: "Suspensión del servicio",
  VERIFICACION_SENAL: "Verificación de señal",
  VERIFICACION_POTENCIA: "Verificación de potencia",
  CONFIGURACION_WIFI: "Configuración WiFi",
  CONFIGURACION_ROUTER: "Configuración de Router",
  CONFIGURACION_ONU: "Configuración de ONU",
  CAMBIO_CANAL_WIFI: "Cambio de canal WiFi",
  ASISTENCIA_SMART_TV: "Asistencia para Smart TV",
  CONFIGURACION_IPTV: "Configuración IPTV",
  CONFIGURACION_STREAMING: "Configuración Streaming",
  ASESORIA_TELEFONICA: "Asesoría telefónica",
  CONSULTA_FACTURACION: "Consulta de facturación",
  CONSULTA_PAGOS: "Consulta de pagos",
  OTRO: "Otro",
};

export const SR_RESULTADO_LABELS: Record<SrResultado, string> = {
  SOLUCIONADO: "Solucionado",
  SOLUCIONADO_PARCIAL: "Solucionado parcialmente",
  ESCALADO_SOPORTE_TECNICO: "Escalado a Soporte Técnico",
  REQUIERE_VISITA: "Requiere visita técnica",
  PENDIENTE_SEGUIMIENTO: "Pendiente de seguimiento",
  SIN_SOLUCION: "Sin solución",
};

export const SR_TIPO_ADJUNTO_LABELS: Record<SrTipoAdjunto, string> = {
  CAPTURA: "Captura de pantalla",
  FOTO_CLIENTE: "Fotografía del cliente",
  PDF: "Archivo PDF",
  OTRO: "Otro",
};

export const SR_ESTADOS = Object.keys(SR_ESTADO_LABELS) as SrEstado[];
export const SR_TIPOS_SOPORTE = Object.keys(SR_TIPO_SOPORTE_LABELS) as SrTipoSoporte[];
export const SR_RESULTADOS = Object.keys(SR_RESULTADO_LABELS) as SrResultado[];
export const SR_TIPOS_ADJUNTO = Object.keys(SR_TIPO_ADJUNTO_LABELS) as SrTipoAdjunto[];

export function puedeAccederSoporteRemoto(rol: string | null | undefined): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR" || rol === "HELP_DESK";
}

export function formatTiempoMinutos(min: number | null | undefined): string {
  if (min == null || Number.isNaN(min)) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export function calcTiempoMinutos(
  horaInicio: Date | null | undefined,
  horaFin: Date | null | undefined
): number | null {
  if (!horaInicio || !horaFin) return null;
  const diff = Math.round((horaFin.getTime() - horaInicio.getTime()) / 60000);
  return diff >= 0 ? diff : null;
}
