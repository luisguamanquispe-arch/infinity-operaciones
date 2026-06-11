import type { EstadoTecnico } from "@prisma/client";

export const MAX_TICKETS_POR_DIA = 4;
export const MAX_TICKETS_TRABAJANDO = 2;

export function cuposDisponibles(estado: EstadoTecnico, asignados: number): number {
  if (estado === "OFFLINE" || estado === "DESCANSO") return 0;
  if (estado === "TRABAJANDO") {
    return Math.max(0, MAX_TICKETS_TRABAJANDO - asignados);
  }
  return Math.max(0, MAX_TICKETS_POR_DIA - asignados);
}

export function diaKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function parseProgramadoEn(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return new Date(`${value}:00-05:00`);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDatetimeLocalValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
