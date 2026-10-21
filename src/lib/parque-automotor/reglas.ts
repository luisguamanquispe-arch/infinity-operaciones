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

export const JUSTIFICACION_REGULARIZACION_MIN = 10;

export const MSG_DUPLICADO_DIA =
  "Ya existe una lectura activa para este vehículo en esa fecha.";

export const MSG_KM_ROMPERIA_POSTERIOR =
  "El kilometraje propuesto es mayor que una lectura posterior y rompería la secuencia.";

export const MSG_ESTIMADA_SIN_JUSTIFICACION =
  "La lectura estimada requiere una justificación.";

export const MSG_SIN_JUSTIFICACION =
  "Indique la justificación de la regularización.";

export const MSG_RANGO_FECHAS = "El período histórico no es válido.";

export type TipoLecturaKm = "REAL" | "ESTIMADA";

export type LecturaVecina = {
  id?: string;
  dia: string;
  kilometraje: number;
};

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const OFFSET_EC_MS = 5 * 60 * 60 * 1000;

export function diaCalendarioEc(fecha: Date): string {
  return new Date(fecha.getTime() - OFFSET_EC_MS).toISOString().slice(0, 10);
}

export function parseDiaCalendario(dia: string | null | undefined): string | null {
  const raw = (dia ?? "").trim();
  if (!DIA_ISO.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return raw;
}

export function fechaHistoricaDesdeDia(dia: string): Date {
  const parsed = parseDiaCalendario(dia);
  if (!parsed) throw new Error(MSG_RANGO_FECHAS);
  const [y, m, d] = parsed.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function validarRangoRegularizacion(
  desde: string,
  hasta: string,
  hoy = diaCalendarioEc(new Date())
): { ok: true; desde: string; hasta: string } | { ok: false; error: string } {
  const d = parseDiaCalendario(desde);
  const h = parseDiaCalendario(hasta);
  if (!d || !h || d > h) return { ok: false, error: MSG_RANGO_FECHAS };
  if (d > hoy || h > hoy) {
    return { ok: false, error: "No se puede regularizar una fecha posterior a hoy." };
  }
  return { ok: true, desde: d, hasta: h };
}

export function enumerarDias(desde: string, hasta: string): string[] {
  const d = parseDiaCalendario(desde);
  const h = parseDiaCalendario(hasta);
  if (!d || !h || d > h) return [];
  const dias: string[] = [];
  let cursor = fechaHistoricaDesdeDia(d);
  const fin = fechaHistoricaDesdeDia(h);
  while (cursor.getTime() <= fin.getTime()) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dias;
}

export function diasFaltantes(
  desde: string,
  hasta: string,
  diasConLectura: string[]
): string[] {
  const cubiertos = new Set(diasConLectura);
  return enumerarDias(desde, hasta).filter((dia) => !cubiertos.has(dia));
}

export function vecinosPorDia(
  lecturas: LecturaVecina[],
  dia: string
): {
  anterior: LecturaVecina | null;
  posterior: LecturaVecina | null;
  duplicado: LecturaVecina | null;
} {
  const ordenadas = [...lecturas].sort((a, b) =>
    a.dia === b.dia ? a.kilometraje - b.kilometraje : a.dia.localeCompare(b.dia)
  );
  const duplicado = ordenadas.find((l) => l.dia === dia) ?? null;
  const anteriores = ordenadas.filter((l) => l.dia < dia);
  const posteriores = ordenadas.filter((l) => l.dia > dia);
  return {
    duplicado,
    anterior: anteriores.length ? anteriores[anteriores.length - 1] : null,
    posterior: posteriores[0] ?? null,
  };
}

export function validarJustificacionRegularizacion(opts: {
  tipoLectura: TipoLecturaKm;
  justificacion: string | null | undefined;
}): { ok: true } | { ok: false; error: string } {
  const texto = (opts.justificacion ?? "").trim();
  if (opts.tipoLectura === "ESTIMADA" && texto.length < JUSTIFICACION_REGULARIZACION_MIN) {
    return { ok: false, error: MSG_ESTIMADA_SIN_JUSTIFICACION };
  }
  if (texto.length < JUSTIFICACION_REGULARIZACION_MIN) {
    return { ok: false, error: MSG_SIN_JUSTIFICACION };
  }
  return { ok: true };
}

export type ItemRegularizacionKm = {
  dia: string;
  kilometraje: number;
  tipoLectura: TipoLecturaKm;
  justificacion: string;
  fuente?: string | null;
};

export function validarItemRegularizacion(
  item: ItemRegularizacionKm,
  lecturas: LecturaVecina[],
  hoy = diaCalendarioEc(new Date())
):
  | {
      ok: true;
      dia: string;
      anterior: LecturaVecina | null;
      posterior: LecturaVecina | null;
    }
  | { ok: false; error: string; duplicado?: LecturaVecina } {
  const dia = parseDiaCalendario(item.dia);
  if (!dia || dia > hoy) return { ok: false, error: MSG_RANGO_FECHAS };
  const km = validarKmNoDescendente(null, item.kilometraje);
  if (!km.ok) return km;
  if (item.tipoLectura !== "REAL" && item.tipoLectura !== "ESTIMADA") {
    return { ok: false, error: "Tipo de lectura inválido." };
  }
  const just = validarJustificacionRegularizacion(item);
  if (!just.ok) return just;
  const { anterior, posterior, duplicado } = vecinosPorDia(lecturas, dia);
  if (duplicado) {
    return { ok: false, error: MSG_DUPLICADO_DIA, duplicado };
  }
  if (anterior && item.kilometraje < anterior.kilometraje) {
    return { ok: false, error: KM_INFERIOR_MSG };
  }
  if (posterior && item.kilometraje > posterior.kilometraje) {
    return { ok: false, error: MSG_KM_ROMPERIA_POSTERIOR };
  }
  return { ok: true, dia, anterior, posterior };
}

export type InconsistenciaKm = {
  kilometrajeActual: number;
  ultimaHistorica: LecturaVecina | null;
  mensaje: string;
};

function ordenarLecturasKm(lecturas: LecturaVecina[]): LecturaVecina[] {
  return [...lecturas].sort((a, b) =>
    a.dia === b.dia ? a.kilometraje - b.kilometraje : a.dia.localeCompare(b.dia)
  );
}

function ultimaPorFecha(lecturas: LecturaVecina[]): LecturaVecina | null {
  const ordenadas = ordenarLecturasKm(lecturas);
  return ordenadas[ordenadas.length - 1] ?? null;
}

/**
 * Aplica varias regularizaciones en memoria (todo o nada).
 * No baja kilometrajeActual. Solo lo sube si una lectura NUEVA queda
 * como la de fecha histórica más reciente y su km es mayor al actual.
 * No corrige en silencio un desfase previo entre odómetro e historial.
 */
export function aplicarRegularizacionEnMemoria(
  estado: { kilometrajeActual: number; lecturas: LecturaVecina[] },
  items: ItemRegularizacionKm[],
  hoy = diaCalendarioEc(new Date())
):
  | {
      ok: true;
      lecturas: LecturaVecina[];
      kilometrajeActual: number;
      aplicadas: ItemRegularizacionKm[];
      actualizoKilometrajeActual: boolean;
      inconsistencia: InconsistenciaKm | null;
    }
  | { ok: false; error: string; duplicado?: LecturaVecina } {
  if (items.length === 0) {
    return { ok: false, error: "No hay fechas para regularizar." };
  }
  const lecturas = [...estado.lecturas];
  const aplicadas: ItemRegularizacionKm[] = [];
  const ordenados = [...items].sort((a, b) => a.dia.localeCompare(b.dia));
  for (const item of ordenados) {
    const v = validarItemRegularizacion(item, lecturas, hoy);
    if (!v.ok) return v;
    lecturas.push({ dia: v.dia, kilometraje: item.kilometraje });
    aplicadas.push({ ...item, dia: v.dia });
  }

  const ultimaExistente = ultimaPorFecha(estado.lecturas);
  const ultimaNueva = ultimaPorFecha(
    aplicadas.map((a) => ({ dia: a.dia, kilometraje: a.kilometraje }))
  );
  const maxDiaExistente = ultimaExistente?.dia ?? "";
  const nuevaEsLaMasReciente =
    !!ultimaNueva && (!maxDiaExistente || ultimaNueva.dia >= maxDiaExistente);

  let kilometrajeActual = estado.kilometrajeActual;
  let actualizoKilometrajeActual = false;
  let inconsistencia: InconsistenciaKm | null = null;

  if (
    ultimaExistente &&
    ultimaExistente.kilometraje !== estado.kilometrajeActual
  ) {
    inconsistencia = {
      kilometrajeActual: estado.kilometrajeActual,
      ultimaHistorica: ultimaExistente,
      mensaje:
        "El kilometraje actual no coincide con la última lectura histórica. Se conservó el valor actual.",
    };
  }

  if (nuevaEsLaMasReciente && ultimaNueva) {
    if (ultimaNueva.kilometraje > estado.kilometrajeActual) {
      kilometrajeActual = ultimaNueva.kilometraje;
      actualizoKilometrajeActual = true;
      inconsistencia = null;
    } else if (ultimaNueva.kilometraje === estado.kilometrajeActual) {
      inconsistencia = null;
    } else {
      inconsistencia = {
        kilometrajeActual: estado.kilometrajeActual,
        ultimaHistorica: ultimaNueva,
        mensaje:
          "La lectura nueva más reciente es inferior al kilometraje actual. No se modificó el odómetro.",
      };
    }
  }

  return {
    ok: true,
    lecturas,
    kilometrajeActual,
    aplicadas,
    actualizoKilometrajeActual,
    inconsistencia,
  };
}

export type PasoPersistenciaKm = "lectura" | "kmActual" | "auditoria";

export type AuditoriaRegularizacionMemoria = {
  accion: "KM_REGULARIZACION";
  registroId: string;
  usuarioId: string;
  motivo: string;
  valorNuevo: {
    km: number;
    fechaHistorica: string;
    tipoLectura: TipoLecturaKm;
    fuente: string | null;
  };
};

/**
 * Contrato atómico en memoria: lecturas + km actual + auditorías, o nada.
 * No sustituye una transacción PostgreSQL.
 */
export function ejecutarLoteRegularizacionAtomico(
  estado: {
    kilometrajeActual: number;
    lecturas: LecturaVecina[];
    auditorias: AuditoriaRegularizacionMemoria[];
  },
  items: ItemRegularizacionKm[],
  opts: { usuarioId: string; fallarEn?: PasoPersistenciaKm; hoy?: string }
):
  | {
      ok: true;
      kilometrajeActual: number;
      lecturas: LecturaVecina[];
      auditorias: AuditoriaRegularizacionMemoria[];
      actualizoKilometrajeActual: boolean;
      inconsistencia: InconsistenciaKm | null;
    }
  | {
      ok: false;
      error: string;
      kilometrajeActual: number;
      lecturas: LecturaVecina[];
      auditorias: AuditoriaRegularizacionMemoria[];
    } {
  const original = {
    kilometrajeActual: estado.kilometrajeActual,
    lecturas: [...estado.lecturas],
    auditorias: [...estado.auditorias],
  };
  const plan = aplicarRegularizacionEnMemoria(
    { kilometrajeActual: estado.kilometrajeActual, lecturas: estado.lecturas },
    items,
    opts.hoy
  );
  if (!plan.ok) {
    return { ...original, ok: false, error: plan.error };
  }
  if (opts.fallarEn === "lectura") {
    return { ...original, ok: false, error: "Fallo al insertar una lectura." };
  }
  const nuevas = plan.aplicadas.map((item, i) => ({
    id: `nueva-${i}`,
    dia: item.dia,
    kilometraje: item.kilometraje,
  }));
  if (opts.fallarEn === "kmActual") {
    return { ...original, ok: false, error: "Fallo al actualizar el kilometraje actual." };
  }
  const auditorias: AuditoriaRegularizacionMemoria[] = plan.aplicadas.map((item, i) => ({
    accion: "KM_REGULARIZACION",
    registroId: nuevas[i].id!,
    usuarioId: opts.usuarioId,
    motivo: item.justificacion,
    valorNuevo: {
      km: item.kilometraje,
      fechaHistorica: item.dia,
      tipoLectura: item.tipoLectura,
      fuente: item.fuente ?? null,
    },
  }));
  if (opts.fallarEn === "auditoria") {
    return { ...original, ok: false, error: "Fallo al insertar la auditoría." };
  }
  return {
    ok: true,
    kilometrajeActual: plan.kilometrajeActual,
    lecturas: [...estado.lecturas, ...nuevas],
    auditorias: [...estado.auditorias, ...auditorias],
    actualizoKilometrajeActual: plan.actualizoKilometrajeActual,
    inconsistencia: plan.inconsistencia,
  };
}
