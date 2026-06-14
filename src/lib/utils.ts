import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("es-EC", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export const TIPO_LABELS: Record<string, string> = {
  INSTALACION: "Instalación",
  SOPORTE: "Soporte",
  INFRAESTRUCTURA: "Infraestructura",
  MIGRACION: "Migración",
  RECONEXION: "Reconexión",
  RETIRO: "Retiro de equipo",
  CORTE: "Corte",
};

export const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  FINALIZADO: "Finalizado",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

export const PRIORIDAD_LABELS: Record<string, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

export const ESTADO_TECNICO_LABELS: Record<string, string> = {
  DISPONIBLE: "Disponible",
  TRABAJANDO: "Trabajando",
  DESCANSO: "Descanso",
  OFFLINE: "Offline",
};

export const FOTO_LABELS: Record<string, string> = {
  FACHADA: "Foto fachada",
  POSTE: "Foto poste",
  NAP: "Foto NAP",
  TRABAJO: "Foto trabajo realizado",
  EMPALME: "Empalmes",
  CAJA_TERMINAL: "Caja terminal",
  ONU: "Foto ONU instalada",
  SPEEDTEST: "Speedtest",
  CLIENTE_CONFORME: "Foto cliente conforme",
};

export const FOTOS_OBLIGATORIAS = [
  "FACHADA",
  "POSTE",
  "NAP",
  "TRABAJO",
  "ONU",
  "SPEEDTEST",
  "CLIENTE_CONFORME",
] as const;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function googleMapsRouteUrl(
  origin: { lat: number; lng: number },
  destinations: { lat: number; lng: number }[]
): string {
  if (destinations.length === 0) return googleMapsUrl(origin.lat, origin.lng);
  const dest = destinations[0];
  const waypoints = destinations
    .slice(1)
    .map((d) => `${d.lat},${d.lng}`)
    .join("|");
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}
