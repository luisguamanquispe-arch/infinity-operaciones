import { formatDateShort, formatDateTime } from "@/lib/utils";
import { diaCalendarioEc } from "./reglas";
import { TIPO_LECTURA_KM_LABELS } from "./labels";

export function formatKm(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("es-EC").format(Math.round(n))} km`;
}

export function formatGalones(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} gal`;
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function formatEntero(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-EC").format(n);
}

export function formatDiaHistorico(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return "—";
  return diaCalendarioEc(d);
}

export function formatFechaCorta(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  return formatDateShort(fecha);
}

export function formatFechaHora(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  return formatDateTime(fecha);
}

/**
 * Diferencia de odómetro solo si ambas lecturas son numéricas y no desciende.
 * No infiere recorrido cuando hay inconsistencia.
 */
export function deltaKmValido(
  anterior: number | null | undefined,
  actual: number | null | undefined
): number | null {
  if (anterior == null || actual == null) return null;
  if (!Number.isFinite(anterior) || !Number.isFinite(actual)) return null;
  if (actual < anterior) return null;
  return actual - anterior;
}

export function etiquetaTipoLectura(
  tipo: string | null | undefined
): { etiqueta: string; estimada: boolean } {
  if (tipo === "ESTIMADA") {
    return { etiqueta: `${TIPO_LECTURA_KM_LABELS.ESTIMADA} (no verificada)`, estimada: true };
  }
  return { etiqueta: TIPO_LECTURA_KM_LABELS.REAL, estimada: false };
}

export function textoCelda(valor: unknown): string {
  if (valor == null || valor === "") return "—";
  return String(valor);
}

/** Evita que Excel convierta identificadores o placas en número. */
export function celdaTextoExcel(valor: string | null | undefined): string {
  const t = (valor ?? "").trim();
  if (!t) return "";
  if (/^[=+\-@]/.test(t)) return `'${t}`;
  return t;
}

export function columnaExcel(indiceCero: number): string {
  let x = indiceCero + 1;
  let s = "";
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** Rango A1 de autofilter sobre la fila de encabezados de datos, no sobre la portada. */
export function rangoAutofiltroExcel(opts: {
  columnas: number;
  filaEncabezado: number;
  totalFilas: number;
}): string | null {
  if (opts.columnas < 1 || opts.totalFilas <= opts.filaEncabezado) return null;
  const last = columnaExcel(opts.columnas - 1);
  return `A${opts.filaEncabezado + 1}:${last}${opts.totalFilas}`;
}

export function sumar(nums: Array<number | null | undefined>): number {
  return nums.reduce<number>((s, n) => s + (typeof n === "number" && Number.isFinite(n) ? n : 0), 0);
}

export type FilaKilometrajeReporte = {
  placa: string;
  vehiculo: string;
  fechaHistorica: string;
  fechaRegistro: string;
  kilometraje: number;
  delta: number | null;
  tipoLectura: string;
  estimada: boolean;
  origen: string;
  fuente: string;
  observacion: string;
  responsable: string;
};

export function filasKilometrajeConDelta(
  lecturas: Array<{
    placa: string;
    marca?: string | null;
    modelo?: string | null;
    fecha: Date;
    createdAt: Date;
    kilometraje: number;
    tipoLectura?: string | null;
    origen: string;
    fuente?: string | null;
    observacion?: string | null;
    responsable?: string | null;
  }>
): FilaKilometrajeReporte[] {
  const orden = [...lecturas].sort((a, b) => {
    const fa = a.fecha.getTime() - b.fecha.getTime();
    if (fa !== 0) return fa;
    const ca = a.createdAt.getTime() - b.createdAt.getTime();
    if (ca !== 0) return ca;
    return a.kilometraje - b.kilometraje;
  });
  const previaPorPlaca = new Map<string, number>();
  const filas: FilaKilometrajeReporte[] = [];
  for (const l of orden) {
    const previa = previaPorPlaca.get(l.placa);
    const tipo = etiquetaTipoLectura(l.tipoLectura);
    filas.push({
      placa: l.placa,
      vehiculo: [l.marca, l.modelo].filter(Boolean).join(" "),
      fechaHistorica: formatDiaHistorico(l.fecha),
      fechaRegistro: formatFechaHora(l.createdAt),
      kilometraje: l.kilometraje,
      delta: deltaKmValido(previa, l.kilometraje),
      tipoLectura: tipo.etiqueta,
      estimada: tipo.estimada,
      origen: l.origen,
      fuente: l.fuente?.trim() || "—",
      observacion: l.observacion?.trim() || "—",
      responsable: l.responsable?.trim() || "—",
    });
    previaPorPlaca.set(l.placa, l.kilometraje);
  }
  return filas.reverse();
}
