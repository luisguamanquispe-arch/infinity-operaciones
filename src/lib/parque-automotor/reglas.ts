import type { Rol } from "@prisma/client";

export const KM_INFERIOR_MSG =
  "El kilometraje registrado es inferior al último kilometraje registrado.";

export const CONSUMO_ANORMAL_MSG = "Consumo fuera del promedio.";

export const MSG_TECNICO_YA_ASIGNADO =
  "El técnico ya tiene un vehículo asignado. Debe realizar primero la recepción del vehículo actual.";

export const MSG_VEHICULO_YA_ASIGNADO =
  "El vehículo ya tiene una asignación abierta. Debe realizar primero la recepción del vehículo actual.";

export const MSG_FUERA_SERVICIO_CAMPO =
  "El vehículo está FUERA DE SERVICIO y no puede registrar operaciones.";

export const ALERTA_NO_APTO = "Vehículo NO APTO — requiere revisión";

/** Desvío relativo vs media del vehículo para marcar consumo anómalo (informativo). */
export const CONSUMO_ANORMAL_UMBRAL = 0.3;

export const ALERTA_MANT_PROXIMO_KM = 800;
export const ALERTA_MANT_URGENTE_KM = 200;
export const ALERTA_DOC_30 = 30;
export const ALERTA_DOC_15 = 15;

export type NivelAlertaVehiculo = "proximo" | "urgente" | "vencido";

export function normalizarPlaca(placa: string | null | undefined): string {
  return (placa ?? "")
    .toLocaleUpperCase("es-EC")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

export function placaValida(placa: string): boolean {
  const p = normalizarPlaca(placa);
  return p.length >= 5 && p.length <= 10;
}

export function puedeGestionarParque(rol: Rol | string | null | undefined): boolean {
  return rol === "SUPERVISOR" || rol === "ADMIN";
}

export function puedeOperarComoTecnicoFlota(
  rol: Rol | string | null | undefined,
  tecnicoId: string | null | undefined
): boolean {
  return rol === "TECNICO" && Boolean(tecnicoId);
}

export function validarKmNoDescendente(
  ultimoKm: number | null | undefined,
  nuevoKm: number
): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(nuevoKm) || nuevoKm < 0 || !Number.isInteger(nuevoKm)) {
    return { ok: false, error: "Kilometraje inválido." };
  }
  if (ultimoKm != null && nuevoKm < ultimoKm) {
    return { ok: false, error: KM_INFERIOR_MSG };
  }
  return { ok: true };
}

export function calcularTotalCombustible(galones: number, precioPorGalon: number): number {
  return Math.round(galones * precioPorGalon * 100) / 100;
}

export function calcularKmPorGalon(
  kmAnterior: number | null,
  kmActual: number,
  galones: number
): { kmRecorridos: number | null; kmPorGalon: number | null } {
  if (kmAnterior == null || galones <= 0 || kmActual < kmAnterior) {
    return { kmRecorridos: null, kmPorGalon: null };
  }
  const kmRecorridos = kmActual - kmAnterior;
  return {
    kmRecorridos,
    kmPorGalon: Math.round((kmRecorridos / galones) * 100) / 100,
  };
}

export function consumoFueraPromedio(
  kmPorGalon: number | null,
  historialKmGalon: number[],
  umbral = CONSUMO_ANORMAL_UMBRAL
): boolean {
  if (kmPorGalon == null || kmPorGalon <= 0 || historialKmGalon.length < 2) {
    return false;
  }
  const media =
    historialKmGalon.reduce((a, b) => a + b, 0) / historialKmGalon.length;
  if (media <= 0) return false;
  return Math.abs(kmPorGalon - media) / media > umbral;
}

export function alertaMantenimientoKm(opts: {
  kmActual: number;
  proximoKm: number | null | undefined;
  nowKm?: number;
}): NivelAlertaVehiculo | null {
  if (opts.proximoKm == null) return null;
  const restante = opts.proximoKm - opts.kmActual;
  if (restante <= 0) return "vencido";
  if (restante <= ALERTA_MANT_URGENTE_KM) return "urgente";
  if (restante <= ALERTA_MANT_PROXIMO_KM) return "proximo";
  return null;
}

export function alertaMantenimientoFecha(
  proximoFecha: Date | string | null | undefined,
  now: Date = new Date()
): NivelAlertaVehiculo | null {
  if (!proximoFecha) return null;
  const due = new Date(proximoFecha).getTime();
  const dias = Math.ceil((due - now.getTime()) / 86400000);
  if (dias < 0) return "vencido";
  if (dias <= 7) return "urgente";
  if (dias <= 30) return "proximo";
  return null;
}

export function alertaDocumento(
  fechaVencimiento: Date | string | null | undefined,
  now: Date = new Date()
): NivelAlertaVehiculo | null {
  if (!fechaVencimiento) return null;
  const dias = Math.ceil(
    (new Date(fechaVencimiento).getTime() - now.getTime()) / 86400000
  );
  if (dias < 0) return "vencido";
  if (dias <= ALERTA_DOC_15) return "urgente";
  if (dias <= ALERTA_DOC_30) return "proximo";
  return null;
}

export function peorAlerta(
  a: NivelAlertaVehiculo | null,
  b: NivelAlertaVehiculo | null
): NivelAlertaVehiculo | null {
  const rank = { proximo: 1, urgente: 2, vencido: 3 };
  if (!a) return b;
  if (!b) return a;
  return rank[a] >= rank[b] ? a : b;
}

export function estadoTrasNovedad(opts: {
  puedeCircular: boolean;
  estadoActual: string;
}): "FUERA_SERVICIO" | null {
  if (!opts.puedeCircular) return "FUERA_SERVICIO";
  return null;
}

export function puedeAsignarEstado(estado: string | null | undefined): boolean {
  return estado === "DISPONIBLE";
}

export function razonNoAsignable(estado: string | null | undefined): string {
  if (estado === "MANTENIMIENTO") {
    return "No se puede asignar un vehículo en mantenimiento.";
  }
  if (estado === "FUERA_SERVICIO") {
    return "El vehículo está FUERA DE SERVICIO y no está disponible para asignar.";
  }
  if (estado === "INACTIVO") {
    return "El vehículo está inactivo y no está disponible para asignar.";
  }
  if (estado === "ASIGNADO") {
    return MSG_VEHICULO_YA_ASIGNADO;
  }
  return "El vehículo no está disponible para asignar.";
}

export function puedeOperarCampo(estado: string | null | undefined): boolean {
  return estado !== "FUERA_SERVICIO";
}

export function estadoTrasInspeccion(
  resultado: "APROBADO" | "CON_NOVEDADES" | "NO_APTO" | string
): "FUERA_SERVICIO" | null {
  return resultado === "NO_APTO" ? "FUERA_SERVICIO" : null;
}

export function tecnicoRechazaIdAjeno(opts: {
  asignadoVehiculoId: string | null | undefined;
  requestedVehiculoId: string | null | undefined;
}): boolean {
  if (!opts.requestedVehiculoId) return false;
  return opts.asignadoVehiculoId !== opts.requestedVehiculoId;
}

/**
 * Aplica lecturas en serie bajo lock: jamás deja el actual por debajo
 * de una lectura ya aceptada (simula FOR UPDATE + validación en TX).
 */
export function aplicarLecturasKmSerializadas(
  kilometrajeInicial: number,
  intentos: number[]
): { kilometrajeActual: number; aceptados: number[]; rechazados: number[] } {
  let actual = kilometrajeInicial;
  const aceptados: number[] = [];
  const rechazados: number[] = [];
  for (const n of intentos) {
    const v = validarKmNoDescendente(actual, n);
    if (!v.ok) {
      rechazados.push(n);
      continue;
    }
    aceptados.push(n);
    actual = n;
  }
  return { kilometrajeActual: actual, aceptados, rechazados };
}

export function kilometrajeTrasUpdateCondicionado(
  actual: number,
  nuevo: number
): number {
  return nuevo >= actual ? nuevo : actual;
}

export function aplicarKmBajoLock(
  estado: { kilometrajeActual: number },
  nuevoKm: number
): { ok: true; kilometrajeActual: number } | { ok: false; error: string } {
  const v = validarKmNoDescendente(estado.kilometrajeActual, nuevoKm);
  if (!v.ok) return v;
  estado.kilometrajeActual = kilometrajeTrasUpdateCondicionado(
    estado.kilometrajeActual,
    nuevoKm
  );
  return { ok: true, kilometrajeActual: estado.kilometrajeActual };
}

export function evaluarAsignacion(opts: {
  estadoVehiculo: string;
  tecnicoTieneAsignacionAbierta: boolean;
  vehiculoTieneAsignacionAbierta: boolean;
}): { ok: true } | { ok: false; status: 409; error: string } {
  if (!puedeAsignarEstado(opts.estadoVehiculo)) {
    return { ok: false, status: 409, error: razonNoAsignable(opts.estadoVehiculo) };
  }
  if (opts.vehiculoTieneAsignacionAbierta) {
    return { ok: false, status: 409, error: MSG_VEHICULO_YA_ASIGNADO };
  }
  if (opts.tecnicoTieneAsignacionAbierta) {
    return { ok: false, status: 409, error: MSG_TECNICO_YA_ASIGNADO };
  }
  return { ok: true };
}

export function evaluarOperacionCampo(
  estadoVehiculo: string | null | undefined
): { ok: true } | { ok: false; status: 409; error: string } {
  if (!puedeOperarCampo(estadoVehiculo)) {
    return { ok: false, status: 409, error: MSG_FUERA_SERVICIO_CAMPO };
  }
  return { ok: true };
}

export function evaluarIdVehiculoTecnico(opts: {
  asignadoVehiculoId: string | null | undefined;
  requestedVehiculoId: string | null | undefined;
}): { ok: true } | { ok: false; status: 403; error: string } {
  if (tecnicoRechazaIdAjeno(opts)) {
    return {
      ok: false,
      status: 403,
      error: "No tiene este vehículo asignado.",
    };
  }
  return { ok: true };
}

export function auditoriaCambioEstado(opts: {
  accion: string;
  estadoAnterior: string;
  estadoNuevo: string;
  motivo?: string | null;
}) {
  return {
    entidad: "Vehiculo" as const,
    accion: opts.accion,
    valorAnterior: { estado: opts.estadoAnterior },
    valorNuevo: { estado: opts.estadoNuevo },
    motivo: opts.motivo ?? null,
    campos: [
      "usuarioId",
      "createdAt",
      "accion",
      "entidad",
      "registroId",
      "valorAnterior",
      "valorNuevo",
      "motivo",
    ] as const,
  };
}

export function resultadoInspeccionDesdeChecklist(items: Record<string, boolean>): {
  resultado: "APROBADO" | "CON_NOVEDADES" | "NO_APTO";
  criticosFallidos: string[];
} {
  const criticos = ["frenos", "llantas", "luces"];
  const keys = Object.keys(items);
  const fallidos = keys.filter((k) => items[k] === false);
  const criticosFallidos = fallidos.filter((k) => criticos.includes(k));
  if (criticosFallidos.length > 0) {
    return { resultado: "NO_APTO", criticosFallidos };
  }
  if (fallidos.length > 0) return { resultado: "CON_NOVEDADES", criticosFallidos: [] };
  return { resultado: "APROBADO", criticosFallidos: [] };
}

export function tecnicoPuedeVerVehiculo(opts: {
  rol: string;
  tecnicoId?: string | null;
  asignacionAbiertaTecnicoId?: string | null;
}): boolean {
  if (opts.rol === "ADMIN" || opts.rol === "SUPERVISOR") return true;
  if (opts.rol !== "TECNICO" || !opts.tecnicoId) return false;
  return opts.asignacionAbiertaTecnicoId === opts.tecnicoId;
}

export function mensajeAlertaMant(opts: {
  placa: string;
  marca?: string;
  modelo?: string;
  restanteKm: number;
}): string {
  const nombre = [opts.marca, opts.modelo, opts.placa].filter(Boolean).join(" ");
  if (opts.restanteKm <= 0) {
    return `${nombre}: mantenimiento vencido.`;
  }
  return `${nombre}: próximo mantenimiento en ${opts.restanteKm} km.`;
}
