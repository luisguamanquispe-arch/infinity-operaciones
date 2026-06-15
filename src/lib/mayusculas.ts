/** Texto en mayúsculas mientras se escribe (conserva espacios intermedios). */
export function enMayusculas(valor: string | null | undefined): string {
  if (valor == null) return "";
  return valor.toLocaleUpperCase("es-EC");
}

/** Mayúsculas y recorte de espacios al guardar en base de datos. */
export function enMayusculasGuardar(valor: string | null | undefined): string {
  return enMayusculas(valor).trim();
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
    ...(input.nombre !== undefined ? { nombre: enMayusculasGuardar(input.nombre) } : {}),
    ...(input.direccion !== undefined ? { direccion: enMayusculasGuardar(input.direccion) } : {}),
    ...(input.sector !== undefined ? { sector: enMayusculasGuardar(input.sector) } : {}),
    ...(input.referencia !== undefined
      ? { referencia: input.referencia ? enMayusculasGuardar(input.referencia) : null }
      : {}),
    ...(input.nodo !== undefined ? { nodo: input.nodo ? enMayusculasGuardar(input.nodo) : null } : {}),
    ...(input.plan !== undefined ? { plan: enMayusculasGuardar(input.plan) } : {}),
  };
}

/** Cliente nuevo con campos obligatorios ya validados. */
export function normalizarClienteNuevo(input: {
  nombre: string;
  direccion: string;
  sector: string;
  plan?: string;
  referencia?: string | null;
  nodo?: string | null;
}) {
  return {
    nombre: enMayusculasGuardar(input.nombre),
    direccion: enMayusculasGuardar(input.direccion),
    sector: enMayusculasGuardar(input.sector),
    plan: enMayusculasGuardar(input.plan || "Sin plan"),
    nodo: input.nodo ? enMayusculasGuardar(input.nodo) : null,
    referencia: input.referencia ? enMayusculasGuardar(input.referencia) : null,
  };
}

export function normalizarTextoTicket(input: {
  motivo?: string | null;
  descripcion?: string | null;
}) {
  return {
    ...input,
    ...(input.motivo !== undefined
      ? { motivo: input.motivo ? enMayusculasGuardar(input.motivo) : null }
      : {}),
    ...(input.descripcion !== undefined
      ? { descripcion: input.descripcion ? enMayusculasGuardar(input.descripcion) : null }
      : {}),
  };
}

/** Clase Tailwind: mayúsculas visuales al escribir (no transformar el valor en onChange). */
export const inputMayusculasClass = "uppercase";
