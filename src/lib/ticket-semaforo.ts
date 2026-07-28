/**
 * Semáforo lógico de tickets activos:
 * - leido: técnico abrió la orden (estado LEIDO) o aún asignado sin abrir (PENDIENTE → “por leer”)
 * - en_proceso: cronómetro / trabajo en curso
 * - terminado: cerrado o finalizado
 */

export type FaseSemaforo = "por_leer" | "leido" | "en_proceso" | "terminado" | "cancelado";

export const ESTADOS_ACTIVOS_SEMAFORO = ["PENDIENTE", "LEIDO", "EN_PROCESO"] as const;

export function faseSemaforoTicket(estado: string): FaseSemaforo {
  switch (estado) {
    case "PENDIENTE":
      return "por_leer";
    case "LEIDO":
      return "leido";
    case "EN_PROCESO":
      return "en_proceso";
    case "CERRADO":
    case "FINALIZADO":
      return "terminado";
    case "CANCELADO":
      return "cancelado";
    default:
      return "por_leer";
  }
}

export const FASE_SEMAFORO_LABELS: Record<FaseSemaforo, string> = {
  por_leer: "Por leer",
  leido: "Leído",
  en_proceso: "En proceso",
  terminado: "Terminado",
  cancelado: "Cancelado",
};

/** Luz activa del semáforo de 3 estados (leído / en proceso / terminado). */
export function luzSemaforoActiva(
  fase: FaseSemaforo
): "leido" | "en_proceso" | "terminado" | null {
  if (fase === "por_leer" || fase === "leido") return "leido";
  if (fase === "en_proceso") return "en_proceso";
  if (fase === "terminado") return "terminado";
  return null;
}
