/**
 * Lógica pura del cronómetro de lectura y atención de tickets de soporte.
 * Compatible con cliente y servidor (sin imports de Prisma).
 */

export type EstadoCronometroAtencion =
  | "PENDIENTE_LECTURA"
  | "EN_ATENCION"
  | "INFORME_REGISTRADO";

export type NivelAlertaAtencion = "NORMAL" | "PROLONGADA" | "CRITICA";

/** Umbrales puramente visuales (no modifican prioridad ni SLA). */
export const UMBRAL_ATENCION_PROLONGADA_SEG = 60 * 60; // 1 hora
export const UMBRAL_ATENCION_CRITICA_SEG = 120 * 60; // 2 horas

export interface RegistroCronometroAtencionLike {
  iniciadoEn: Date | string;
  finalizadoEn: Date | string | null;
  duracionSegundos: number | null;
  tecnicoId?: string | null;
  iniciadoPorUsuarioId?: string | null;
  iniciadoPorNombre?: string | null;
  tecnicoNombre?: string | null;
}

export interface CronometroAtencionView {
  estado: EstadoCronometroAtencion;
  iniciadoEn: string | null;
  finalizadoEn: string | null;
  duracionSegundos: number;
  alerta: NivelAlertaAtencion;
  iniciadoPorNombre: string | null;
  tecnicoNombre: string | null;
}

/** Aplica a tickets de soporte de cliente en el flujo técnico (no infraestructura). */
export function ticketAdmiteCronometroAtencion(tipo: string | null | undefined): boolean {
  if (!tipo) return false;
  return tipo !== "INFRAESTRUCTURA";
}

export function toIsoOrNull(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function calcularDuracionAtencionSegundos(
  iniciadoEn: Date | string | null | undefined,
  finalizadoEn: Date | string | null | undefined,
  duracionGuardada?: number | null,
  ahoraMs: number = Date.now()
): number {
  if (!iniciadoEn) return 0;
  if (finalizadoEn != null && typeof duracionGuardada === "number" && duracionGuardada >= 0) {
    return Math.floor(duracionGuardada);
  }
  const iniMs = (iniciadoEn instanceof Date ? iniciadoEn : new Date(iniciadoEn)).getTime();
  if (Number.isNaN(iniMs)) return 0;
  const finMs = finalizadoEn
    ? (finalizadoEn instanceof Date ? finalizadoEn : new Date(finalizadoEn)).getTime()
    : ahoraMs;
  if (Number.isNaN(finMs)) return 0;
  return Math.max(0, Math.floor((finMs - iniMs) / 1000));
}

export function nivelAlertaAtencion(
  estado: EstadoCronometroAtencion,
  duracionSegundos: number
): NivelAlertaAtencion {
  if (estado !== "EN_ATENCION") return "NORMAL";
  if (duracionSegundos >= UMBRAL_ATENCION_CRITICA_SEG) return "CRITICA";
  if (duracionSegundos >= UMBRAL_ATENCION_PROLONGADA_SEG) return "PROLONGADA";
  return "NORMAL";
}

export function derivarEstadoCronometroAtencion(
  registro: RegistroCronometroAtencionLike | null | undefined,
  ahoraMs: number = Date.now()
): CronometroAtencionView {
  if (!registro || !registro.iniciadoEn) {
    return {
      estado: "PENDIENTE_LECTURA",
      iniciadoEn: null,
      finalizadoEn: null,
      duracionSegundos: 0,
      alerta: "NORMAL",
      iniciadoPorNombre: null,
      tecnicoNombre: null,
    };
  }

  const estado: EstadoCronometroAtencion = registro.finalizadoEn
    ? "INFORME_REGISTRADO"
    : "EN_ATENCION";

  const duracionSegundos = calcularDuracionAtencionSegundos(
    registro.iniciadoEn,
    registro.finalizadoEn,
    registro.duracionSegundos,
    ahoraMs
  );

  return {
    estado,
    iniciadoEn: toIsoOrNull(registro.iniciadoEn),
    finalizadoEn: toIsoOrNull(registro.finalizadoEn),
    duracionSegundos,
    alerta: nivelAlertaAtencion(estado, duracionSegundos),
    iniciadoPorNombre: registro.iniciadoPorNombre ?? null,
    tecnicoNombre: registro.tecnicoNombre ?? null,
  };
}

/** Formato HH:MM:SS (siempre con 2 dígitos por componente; soporta >= 100h). */
export function formatHHMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const ESTADO_CRONOMETRO_ATENCION_LABELS: Record<EstadoCronometroAtencion, string> = {
  PENDIENTE_LECTURA: "Pendiente de lectura",
  EN_ATENCION: "En atención",
  INFORME_REGISTRADO: "Informe registrado",
};
