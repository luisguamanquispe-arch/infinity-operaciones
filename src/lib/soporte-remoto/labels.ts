import type {
  Prioridad,
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
  ESCALADO: "Escalado",
};

export const SR_PRIORIDAD_LABELS: Record<Prioridad, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

/** Motivos del catálogo principal (orden del formulario). */
export const SR_TIPO_SOPORTE_LABELS: Record<SrTipoSoporte, string> = {
  SIN_INTERNET: "Sin Internet",
  INTERNET_LENTO: "Internet lento",
  CAMBIO_PASSWORD_WIFI: "Cambio de contraseña WiFi",
  CAMBIO_SSID: "Cambio de nombre WiFi (SSID)",
  REINICIO_ROUTER: "Reinicio de Router",
  REINICIO_ONU: "Reinicio de ONU",
  REINICIO_PUERTO_OLT: "Reinicio de Puerto OLT",
  CONFIGURACION_ROUTER: "Configuración Router",
  CONFIGURACION_ONU: "Configuración ONU",
  CAMBIO_CANAL_WIFI: "Cambio de canal WiFi",
  ACTUALIZACION_DATOS_CLIENTE: "Actualización de datos",
  REACTIVACION_PAGO: "Reactivación del servicio",
  SUSPENSION_SERVICIO: "Suspensión del servicio",
  CAMBIO_PLAN: "Cambio de Plan",
  CONFIGURACION_IPTV: "Configuración IPTV",
  CONFIGURACION_STREAMING: "Configuración Streaming",
  VERIFICACION_POTENCIA: "Verificación de potencia",
  VERIFICACION_SENAL: "Verificación de señal",
  ASESORIA_TELEFONICA: "Asesoría telefónica",
  CONSULTA_FACTURACION: "Consulta de facturación",
  CONSULTA_PAGOS: "Consulta de pagos",
  ACTIVACION_SERVICIO: "Activación del servicio",
  CONFIGURACION_WIFI: "Configuración WiFi",
  ASISTENCIA_SMART_TV: "Asistencia para Smart TV",
  OTRO: "Otro",
};

/** Orden en el select del formulario (sin tipos legacy al final). */
export const SR_MOTIVOS_FORMULARIO: SrTipoSoporte[] = [
  "SIN_INTERNET",
  "INTERNET_LENTO",
  "CAMBIO_PASSWORD_WIFI",
  "CAMBIO_SSID",
  "REINICIO_ROUTER",
  "REINICIO_ONU",
  "REINICIO_PUERTO_OLT",
  "CONFIGURACION_ROUTER",
  "CONFIGURACION_ONU",
  "CAMBIO_CANAL_WIFI",
  "ACTUALIZACION_DATOS_CLIENTE",
  "REACTIVACION_PAGO",
  "SUSPENSION_SERVICIO",
  "CAMBIO_PLAN",
  "CONFIGURACION_IPTV",
  "CONFIGURACION_STREAMING",
  "VERIFICACION_POTENCIA",
  "VERIFICACION_SENAL",
  "ASESORIA_TELEFONICA",
  "CONSULTA_FACTURACION",
  "CONSULTA_PAGOS",
  "OTRO",
];

export const SR_RESULTADO_LABELS: Record<SrResultado, string> = {
  SOLUCIONADO: "Solucionado",
  SOLUCIONADO_PARCIAL: "Solucionado Parcialmente",
  ESCALADO_SOPORTE_TECNICO: "Escalado a Técnico",
  REQUIERE_VISITA: "Requiere Visita",
  PENDIENTE_SEGUIMIENTO: "Pendiente",
  SIN_SOLUCION: "Sin Solución",
};

export const SR_TIPO_ADJUNTO_LABELS: Record<SrTipoAdjunto, string> = {
  CAPTURA: "Captura de pantalla",
  FOTO_CLIENTE: "Fotografía del cliente",
  PDF: "PDF",
  DOCUMENTO: "Documento",
  OTRO: "Otro",
};

export const SR_ESTADOS = Object.keys(SR_ESTADO_LABELS) as SrEstado[];
export const SR_TIPOS_SOPORTE = Object.keys(SR_TIPO_SOPORTE_LABELS) as SrTipoSoporte[];
export const SR_RESULTADOS = Object.keys(SR_RESULTADO_LABELS) as SrResultado[];
export const SR_TIPOS_ADJUNTO = Object.keys(SR_TIPO_ADJUNTO_LABELS) as SrTipoAdjunto[];
export const SR_PRIORIDADES = Object.keys(SR_PRIORIDAD_LABELS) as Prioridad[];

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
