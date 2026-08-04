import type { MotivoJustificacionTecnica } from "@prisma/client";

export const MOTIVO_JUSTIFICACION_LABELS: Record<MotivoJustificacionTecnica, string> = {
  CLIENTE_AUSENTE: "Cliente ausente",
  CLIENTE_NO_PERMITE_INGRESO: "Cliente no permitió el ingreso",
  DIRECCION_INCORRECTA: "Dirección incorrecta",
  SIN_ACCESO_INFRAESTRUCTURA: "Sin acceso a la infraestructura",
  FALTA_MATERIALES: "Falta de materiales",
  DANO_MAYOR_NO_PROGRAMADO: "Daño mayor no programado",
  RIESGO_TECNICO: "Riesgo para el técnico",
  CONDICIONES_CLIMATICAS: "Condiciones climáticas",
  ESPERANDO_AUTORIZACION: "Esperando autorización",
  OTRO: "Otro",
};

export const MOTIVOS_JUSTIFICACION = Object.keys(
  MOTIVO_JUSTIFICACION_LABELS
) as MotivoJustificacionTecnica[];

export function motivoJustificacionTexto(
  motivo: MotivoJustificacionTecnica | null | undefined,
  otro?: string | null
): string {
  if (!motivo) return "";
  if (motivo === "OTRO" && otro?.trim()) return `Otro: ${otro.trim()}`;
  return MOTIVO_JUSTIFICACION_LABELS[motivo] ?? motivo;
}

/** Solo el técnico responsable (Ticket.tecnicoId) puede usar justificación técnica. */
export function puedeCerrarConJustificacion(
  ticket: { tecnicoId: string | null },
  tecnicoId: string | null | undefined
): boolean {
  if (!tecnicoId || !ticket.tecnicoId) return false;
  return ticket.tecnicoId === tecnicoId;
}
