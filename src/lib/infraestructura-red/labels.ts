import type { IrEstadoReporte, IrTipoFoto, IrTipoFirma, IrTipoTrabajo, Prioridad } from "@prisma/client";

export type { IrEstadoReporte, IrTipoFoto, IrTipoFirma, IrTipoTrabajo };

export const IR_ESTADO_LABELS: Record<IrEstadoReporte, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  FINALIZADO: "Finalizado",
};

export const IR_TIPO_TRABAJO_LABELS: Record<IrTipoTrabajo, string> = {
  CORTE_FIBRA: "Corte de fibra",
  EMPALME: "Empalme",
  CAMBIO_NAP: "Cambio de NAP",
  CAMBIO_CTO: "Cambio de CTO",
  CAMBIO_SPLITTER: "Cambio de Splitter",
  CAMBIO_POSTE: "Cambio de Poste",
  CAMBIO_CABLE: "Cambio de Cable",
  MANTENIMIENTO_PREVENTIVO: "Mantenimiento Preventivo",
  MANTENIMIENTO_CORRECTIVO: "Mantenimiento Correctivo",
  AMPLIACION_RED: "Ampliación de Red",
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
export const IR_TIPOS_FOTO = Object.keys(IR_TIPO_FOTO_LABELS) as IrTipoFoto[];

export function puedeAccederInfraestructura(rol: string | null | undefined): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR" || rol === "TECNICO";
}

export function puedeGestionarInfraestructura(rol: string | null | undefined): boolean {
  return rol === "ADMIN" || rol === "SUPERVISOR";
}
