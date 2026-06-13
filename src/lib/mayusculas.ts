/** Texto en mayúsculas para datos operativos (clientes, tickets, etc.). */
export function enMayusculas(valor: string | null | undefined): string {
  if (valor == null) return "";
  return valor.toLocaleUpperCase("es-EC").trim();
}

export function normalizarTextoCliente(input: {
  nombre?: string;
  direccion?: string;
  sector?: string;
  referencia?: string | null;
  nodo?: string | null;
  plan?: string;
}) {
  return {
    ...input,
    ...(input.nombre !== undefined ? { nombre: enMayusculas(input.nombre) } : {}),
    ...(input.direccion !== undefined ? { direccion: enMayusculas(input.direccion) } : {}),
    ...(input.sector !== undefined ? { sector: enMayusculas(input.sector) } : {}),
    ...(input.referencia !== undefined
      ? { referencia: input.referencia ? enMayusculas(input.referencia) : null }
      : {}),
    ...(input.nodo !== undefined ? { nodo: input.nodo ? enMayusculas(input.nodo) : null } : {}),
    ...(input.plan !== undefined ? { plan: enMayusculas(input.plan) } : {}),
  };
}

export function normalizarTextoTicket(input: {
  motivo?: string | null;
  descripcion?: string | null;
}) {
  return {
    ...input,
    ...(input.motivo !== undefined
      ? { motivo: input.motivo ? enMayusculas(input.motivo) : null }
      : {}),
    ...(input.descripcion !== undefined
      ? { descripcion: input.descripcion ? enMayusculas(input.descripcion) : null }
      : {}),
  };
}

/** Clase Tailwind para inputs con ingreso en mayúsculas. */
export const inputMayusculasClass = "uppercase";
