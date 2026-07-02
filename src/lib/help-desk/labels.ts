import type {
  HdCanal,
  HdEstadoConversacion,
  HdMotivoEscalamiento,
  HdTipoAccionRemota,
} from "@prisma/client";

export const HD_ESTADO_LABELS: Record<HdEstadoConversacion, string> = {
  EN_COLA: "En cola",
  EN_ATENCION: "En atención",
  EN_ESPERA_CLIENTE: "Esperando cliente",
  RESUELTO: "Resuelto remoto",
  ESCALADO: "Escalado a campo",
  CERRADO: "Cerrado",
};

export const HD_CANAL_LABELS: Record<HdCanal, string> = {
  WHATSAPP: "WhatsApp",
  CHAT: "Chat web",
  LLAMADA: "Llamada VoIP",
  VIDEO: "Videollamada",
};

export const HD_MOTIVO_ESCALA_LABELS: Record<HdMotivoEscalamiento, string> = {
  FIBRA_ROTA: "Fibra rota",
  NAP_DANADA: "Caja NAP dañada",
  ONU_DANADA: "ONU dañada",
  ROUTER_DANADO: "Router dañado",
  SIN_POTENCIA: "Sin potencia",
  CAMBIO_ACOMETIDA: "Cambio de acometida",
  INSTALACION: "Instalación",
  MUDANZA: "Mudanza",
  REUBICACION: "Reubicación",
  OTRO: "Otro",
};

export const HD_ACCION_LABELS: Record<HdTipoAccionRemota, string> = {
  WIFI_SSID: "Cambiar SSID WiFi",
  WIFI_PASSWORD: "Cambiar contraseña WiFi",
  WIFI_CANAL: "Cambiar canal WiFi",
  WIFI_OCULTAR: "Ocultar red WiFi",
  ROUTER_REINICIO: "Reiniciar router",
  ROUTER_FIRMWARE: "Actualizar firmware",
  ROUTER_BACKUP: "Respaldar configuración",
  ROUTER_RESTORE: "Restaurar respaldo",
  SPEED_TEST: "Speed test",
  PING: "Ping",
  TRACEROUTE: "Traceroute",
  DNS_TEST: "Prueba DNS",
  DIAG_POTENCIA: "Consultar potencia óptica",
  DIAG_ONU: "Estado ONU",
  DIAG_DISPOSITIVOS: "Dispositivos conectados",
  OTRO: "Otra acción",
};
