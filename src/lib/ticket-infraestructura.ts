import type {
  MotivoInfraestructura,
  SiResultado,
  SiTipoTrabajo,
  TipoFoto,
  TipoTrabajo,
} from "@prisma/client";

export function esTicketInfraestructura(tipo: string): boolean {
  return tipo === "INFRAESTRUCTURA";
}

export function esTipoTrabajoInfra(tipo: TipoTrabajo | string): boolean {
  return tipo === "INFRAESTRUCTURA";
}

/** @deprecated Prefer SI_TIPO_TRABAJO_LABELS; conservado para reportes legacy. */
export const MOTIVO_INFRA_LABELS: Record<MotivoInfraestructura, string> = {
  CORTE_ELECTRICO: "Corte eléctrico",
  CORTE_FIBRA: "Corte de fibra",
  CONFIG_NODO: "Configuración de nodo",
  ACTUALIZACION: "Actualización",
};

export const MOTIVOS_INFRA = Object.keys(MOTIVO_INFRA_LABELS) as MotivoInfraestructura[];

export const SI_TIPO_TRABAJO_LABELS: Record<SiTipoTrabajo, string> = {
  CORTE_FIBRA: "Corte de fibra",
  EMPALME: "Empalme",
  CAMBIO_NAP: "Cambio de NAP",
  CAMBIO_CTO: "Cambio de CTO",
  CAMBIO_SPLITTER: "Cambio de Splitter",
  CAMBIO_ODF: "Cambio de ODF",
  CAMBIO_POSTE: "Cambio de Poste",
  CAMBIO_CABLE: "Cambio de Cable",
  REUBICACION: "Reubicación",
  MANTENIMIENTO_PREVENTIVO: "Mantenimiento Preventivo",
  MANTENIMIENTO_CORRECTIVO: "Mantenimiento Correctivo",
  EXPANSION_RED: "Expansión de Red",
  OTRO: "Otro",
};

export const SI_TIPOS_TRABAJO = Object.keys(SI_TIPO_TRABAJO_LABELS) as SiTipoTrabajo[];

export const SI_RESULTADO_LABELS: Record<SiResultado, string> = {
  REPARADO: "Reparado",
  REPARADO_PARCIAL: "Reparado parcialmente",
  PENDIENTE: "Pendiente",
  REQUIERE_NUEVA_INTERVENCION: "Requiere nueva intervención",
};

export const SI_RESULTADOS = Object.keys(SI_RESULTADO_LABELS) as SiResultado[];

/** Estados de UI para Soporte de Infraestructura (mapean EstadoTicket). */
export const SI_ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  LEIDO: "Asignada",
  EN_PROCESO: "En proceso",
  FINALIZADO: "Finalizada",
  CERRADO: "Finalizada",
  CANCELADO: "Cancelada",
};

export const FOTOS_OBLIGATORIAS_INFRA: TipoFoto[] = ["POSTE", "NAP", "TRABAJO"];

export const FOTOS_ANTES_INFRA: TipoFoto[] = ["FACHADA", "POSTE", "NAP"];
export const FOTOS_DURANTE_INFRA: TipoFoto[] = ["TRABAJO", "EMPALME", "CAJA_TERMINAL"];
export const FOTOS_FINAL_INFRA: TipoFoto[] = ["ONU", "TRABAJO"];

/** Alias Después = Final. */
export const FOTOS_DESPUES_INFRA = FOTOS_FINAL_INFRA;

export function minTecnicosInfraestructura(): number {
  return 1;
}

export function motivoInfraTexto(motivo: MotivoInfraestructura | null | undefined): string {
  if (!motivo) return "";
  return MOTIVO_INFRA_LABELS[motivo] ?? motivo;
}

export function siTipoTrabajoTexto(
  tipo: SiTipoTrabajo | null | undefined,
  otro?: string | null
): string {
  if (!tipo) return "";
  if (tipo === "OTRO" && otro?.trim()) return `Otro: ${otro.trim()}`;
  return SI_TIPO_TRABAJO_LABELS[tipo] ?? tipo;
}

export function mapMotivoToSiTipo(motivo: MotivoInfraestructura): SiTipoTrabajo {
  if (motivo === "CORTE_FIBRA") return "CORTE_FIBRA";
  return "MANTENIMIENTO_CORRECTIVO";
}

/** Solo el técnico responsable (Ticket.tecnicoId) puede cerrar la orden SI. */
export function puedeCerrarSoporteInfra(
  ticket: { tipo: string; tecnicoId: string | null },
  tecnicoId: string | null | undefined
): boolean {
  if (!esTicketInfraestructura(ticket.tipo)) return true;
  if (!tecnicoId || !ticket.tecnicoId) return false;
  return ticket.tecnicoId === tecnicoId;
}

export function esColaboradorSoporteInfra(
  ticket: { tipo: string; tecnicoId: string | null },
  tecnicoId: string
): boolean {
  if (!esTicketInfraestructura(ticket.tipo)) return false;
  return !!ticket.tecnicoId && ticket.tecnicoId !== tecnicoId;
}
