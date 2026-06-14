import type { MotivoInfraestructura, TipoFoto, TipoTrabajo } from "@prisma/client";

export function esTicketInfraestructura(tipo: string): boolean {
  return tipo === "INFRAESTRUCTURA";
}

export const MOTIVO_INFRA_LABELS: Record<MotivoInfraestructura, string> = {
  CORTE_ELECTRICO: "Corte eléctrico",
  CORTE_FIBRA: "Corte de fibra",
  CONFIG_NODO: "Configuración de nodo",
  ACTUALIZACION: "Actualización",
};

export const MOTIVOS_INFRA = Object.keys(MOTIVO_INFRA_LABELS) as MotivoInfraestructura[];

/** Fotos mínimas para cerrar un ticket de infraestructura. */
export const FOTOS_OBLIGATORIAS_INFRA: TipoFoto[] = ["POSTE", "NAP", "TRABAJO"];

export const FOTOS_ANTES_INFRA: TipoFoto[] = ["POSTE", "NAP"];
export const FOTOS_DURANTE_INFRA: TipoFoto[] = ["TRABAJO", "EMPALME", "CAJA_TERMINAL"];
export const FOTOS_FINAL_INFRA: TipoFoto[] = ["TRABAJO"];

export function minTecnicosInfraestructura(): number {
  return 2;
}

export function motivoInfraTexto(motivo: MotivoInfraestructura | null | undefined): string {
  if (!motivo) return "";
  return MOTIVO_INFRA_LABELS[motivo] ?? motivo;
}

export function esTipoTrabajoInfra(tipo: TipoTrabajo | string): boolean {
  return tipo === "INFRAESTRUCTURA";
}
