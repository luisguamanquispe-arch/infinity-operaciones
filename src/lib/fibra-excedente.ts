/** Metros de drop incluidos sin cobro extra en tickets normales. */
export const FIBRA_DROP_LIMITE_M = 350;

/** Materiales de fibra drop del abonado (metros). */
export function esFibraDropCliente(nombre: string): boolean {
  const n = nombre.toLowerCase();
  return (
    n.includes("cable drop") ||
    n.includes("fibra droop") ||
    n.includes("fibra drop")
  );
}

export function excedenteFibraDrop(cantidad: number | string): number {
  const c = typeof cantidad === "string" ? parseFloat(cantidad) : cantidad;
  if (Number.isNaN(c) || c <= FIBRA_DROP_LIMITE_M) return 0;
  return Math.round((c - FIBRA_DROP_LIMITE_M) * 100) / 100;
}

export function calcularExcedenteMaterial(
  nombre: string,
  cantidad: number | string,
  esTicketInfra: boolean
): number {
  if (esTicketInfra || !esFibraDropCliente(nombre)) return 0;
  return excedenteFibraDrop(cantidad);
}
