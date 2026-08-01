import type {
  IrEquipoTipo,
  IrEstadoReporte,
  IrResultado,
  IrTipoFoto,
  IrTipoFirma,
  IrTipoTrabajo,
  Prioridad,
} from "@prisma/client";

export type {
  IrEquipoTipo,
  IrEstadoReporte,
  IrResultado,
  IrTipoFoto,
  IrTipoFirma,
  IrTipoTrabajo,
};

export const IR_ESTADO_LABELS: Record<IrEstadoReporte, string> = {
  PENDIENTE: "Pendiente",
  ASIGNADO: "Asignado",
  EN_PROCESO: "En proceso",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

export const IR_TIPO_TRABAJO_LABELS: Record<IrTipoTrabajo, string> = {
  CORTE_FIBRA: "Corte de Fibra",
  EMPALME: "Empalme",
  CAMBIO_NAP: "Cambio de NAP",
  CAMBIO_CTO: "Cambio de CTO",
  CAMBIO_SPLITTER: "Cambio de Splitter",
  CAMBIO_ODF: "Cambio de ODF",
  CAMBIO_CAJA_PASO: "Cambio de Caja de Paso",
  CAMBIO_POSTE: "Cambio de Poste",
  CAMBIO_HERRAJES: "Cambio de Herrajes",
  CAMBIO_CABLE_TRONCAL: "Cambio de Cable Troncal",
  CAMBIO_CABLE_DISTRIBUCION: "Cambio de Cable Distribución",
  CAMBIO_CABLE: "Cambio de Cable",
  MANTENIMIENTO_PREVENTIVO: "Mantenimiento Preventivo",
  MANTENIMIENTO_CORRECTIVO: "Mantenimiento Correctivo",
  REUBICACION_RED: "Reubicación de Red",
  AMPLIACION_RED: "Ampliación de Red",
  INSTALACION_TRONCAL: "Instalación de Nueva Troncal",
  INSPECCION_RED: "Inspección de Red",
  OTRO: "Otro",
};

export const IR_RESULTADO_LABELS: Record<IrResultado, string> = {
  REPARADO: "Reparado",
  REPARADO_PARCIAL: "Reparado Parcialmente",
  PENDIENTE_MATERIAL: "Pendiente de Material",
  REQUIERE_NUEVA_INTERVENCION: "Requiere Nueva Intervención",
  CANCELADO: "Cancelado",
};

export const IR_EQUIPO_LABELS: Record<IrEquipoTipo, string> = {
  FUSIONADORA: "Fusionadora",
  OTDR: "OTDR",
  POWER_METER: "Power Meter",
  VFL: "VFL",
  ESCALERA: "Escalera",
  CAMIONETA: "Camioneta",
  OTRO: "Otro",
};

export const IR_PRIORIDAD_LABELS: Record<Prioridad, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

export const IR_TIPO_FOTO_LABELS: Record<IrTipoFoto, string> = {
  ANTES: "Antes",
  DURANTE: "Durante",
  DESPUES: "Después",
};

export const IR_TIPO_FIRMA_LABELS: Record<IrTipoFirma, string> = {
  TECNICO: "Técnico",
  SUPERVISOR: "Supervisor",
};

export const IR_TIPOS_TRABAJO = Object.keys(IR_TIPO_TRABAJO_LABELS) as IrTipoTrabajo[];
export const IR_ESTADOS = Object.keys(IR_ESTADO_LABELS) as IrEstadoReporte[];
export const IR_RESULTADOS = Object.keys(IR_RESULTADO_LABELS) as IrResultado[];
export const IR_EQUIPOS = Object.keys(IR_EQUIPO_LABELS) as IrEquipoTipo[];
export const IR_TIPOS_FOTO = Object.keys(IR_TIPO_FOTO_LABELS) as IrTipoFoto[];

export const IR_TIPOS_PREVENTIVOS: IrTipoTrabajo[] = [
  "MANTENIMIENTO_PREVENTIVO",
  "INSPECCION_RED",
];

export const IR_TIPOS_CORRECTIVOS: IrTipoTrabajo[] = [
  "CORTE_FIBRA",
  "EMPALME",
  "CAMBIO_NAP",
  "CAMBIO_CTO",
  "CAMBIO_SPLITTER",
  "CAMBIO_ODF",
  "CAMBIO_CAJA_PASO",
  "CAMBIO_POSTE",
  "CAMBIO_HERRAJES",
  "CAMBIO_CABLE_TRONCAL",
  "CAMBIO_CABLE_DISTRIBUCION",
  "CAMBIO_CABLE",
  "MANTENIMIENTO_CORRECTIVO",
];

export function puedeAccederInfraestructura(rol: string | null | undefined): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR" || rol === "TECNICO";
}

export function puedeGestionarInfraestructura(rol: string | null | undefined): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR";
}

export function esTipoPreventivo(tipo: IrTipoTrabajo): boolean {
  return IR_TIPOS_PREVENTIVOS.includes(tipo);
}

export function esTipoCorrectivo(tipo: IrTipoTrabajo): boolean {
  return IR_TIPOS_CORRECTIVOS.includes(tipo);
}

export function formatoTiempoMinutos(min: number | null | undefined): string {
  if (min == null || Number.isNaN(min)) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${m.toString().padStart(2, "0")} min`;
}
