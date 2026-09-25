import type { TipoInventario, TipoPatchCord, TrabajoExpress } from "@prisma/client";
import {
  materialEsCableOFibra,
  materialEsEquipoActivo,
  materialEsPatchcord,
  tipoInventarioEfectivo,
} from "./material-detalle";

/** Declaración explícita cuando un soporte express no usó equipos ni materiales. */
export const MARCA_SIN_EQUIPOS = "SIN EQUIPOS NI MATERIALES UTILIZADOS";

export const ERROR_INSTALACION_SIN_USO =
  "Debe registrar al menos un equipo o material utilizado antes de cerrar una instalación nueva.";

export const MENSAJE_INSTALACION_FRONT =
  "Debe registrar los equipos y materiales utilizados antes de finalizar la instalación.";

export type ClaseUsoOt = "EQUIPO" | "MATERIAL";

export type RegimenUsoOt = "INSTALACION" | "EQUIPO" | "MATERIAL" | "OPCIONAL";

const EXPRESS_EQUIPO = new Set<TrabajoExpress>([
  "INSTALACION_REPETIDOR_WIFI",
  "ENTREGA_EQUIPO",
  "RETIRO_EQUIPO",
]);

const EXPRESS_MATERIAL = new Set<TrabajoExpress>([
  "CAMBIO_PATCH_CORD",
  "CAMBIO_ROSETA",
  "CAMBIO_CONECTOR_RJ45",
  "CAMBIO_FUENTE_PODER",
]);

export interface LineaUsoOt {
  cantidad: number | string | null;
  serie?: string | null;
  modelo?: string | null;
  marca?: string | null;
  tipoPatchCord?: TipoPatchCord | string | null;
  inventario?: {
    nombre?: string | null;
    tipo?: TipoInventario | string | null;
    unidad?: string | null;
  } | null;
}

export function regimenExpress(trabajo: TrabajoExpress | null | undefined): RegimenUsoOt {
  if (!trabajo) return "OPCIONAL";
  if (EXPRESS_EQUIPO.has(trabajo)) return "EQUIPO";
  if (EXPRESS_MATERIAL.has(trabajo)) return "MATERIAL";
  return "OPCIONAL";
}

export function esLineaEquipo(linea: LineaUsoOt): boolean {
  const nombre = linea.inventario?.nombre ?? "";
  const tipo = tipoInventarioEfectivo(
    (linea.inventario?.tipo as TipoInventario | undefined) ?? "CONSUMIBLE",
    nombre
  );
  return tipo === "EQUIPO" || materialEsEquipoActivo(nombre);
}

export function cantidadPositiva(valor: number | string | null | undefined): number | null {
  if (valor == null || valor === "") return null;
  const n = typeof valor === "number" ? valor : parseFloat(String(valor));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function unidadEsMetros(unidad: string | null | undefined): boolean {
  const u = (unidad ?? "").trim().toLowerCase();
  return u === "m" || u === "mt" || u === "mts" || u === "metro" || u === "metros";
}

export function declaraSinUso(texto: string | null | undefined): boolean {
  return (texto ?? "").toUpperCase().includes(MARCA_SIN_EQUIPOS);
}

export function observacionSinUsoValida(texto: string | null | undefined): boolean {
  const limpio = (texto ?? "")
    .replace(new RegExp(MARCA_SIN_EQUIPOS, "gi"), "")
    .replace(/observaciones:/gi, "")
    .trim();
  return limpio.length >= 10;
}

/** Errores de una línea ya elegida. Null si está completa. */
export function erroresLineaUso(linea: LineaUsoOt): string[] {
  const nombre = linea.inventario?.nombre?.trim() || "";
  const errores: string[] = [];
  const cantidad = cantidadPositiva(linea.cantidad);
  if (cantidad == null) {
    errores.push("La cantidad debe ser un número mayor que 0");
  }

  if (esLineaEquipo(linea)) {
    if (!linea.marca?.trim()) errores.push("Indique la marca del equipo");
    if (!linea.modelo?.trim()) errores.push("Indique el modelo del equipo");
    if (!linea.serie?.trim()) errores.push("Indique la serie del equipo");
    return errores;
  }

  if (!nombre) errores.push("Indique el elemento del material");
  const tipoInv = tipoInventarioEfectivo(
    (linea.inventario?.tipo as TipoInventario | undefined) ?? "CONSUMIBLE",
    nombre
  );

  if (materialEsCableOFibra(nombre)) {
    if (!linea.modelo?.trim()) errores.push("Indique el tipo de fibra (por ejemplo Drop)");
    const unidad = linea.inventario?.unidad;
    if (unidad && !unidadEsMetros(unidad)) {
      errores.push("La fibra debe registrarse en metros");
    }
    return errores;
  }

  if (materialEsPatchcord(tipoInv, nombre)) {
    if (!linea.tipoPatchCord) errores.push("Indique el tipo de patch cord");
    return errores;
  }

  if (!linea.modelo?.trim()) errores.push("Indique el tipo o la presentación del material");
  return errores;
}

export function erroresUsoEnCierre(input: {
  esInstalacion?: boolean;
  esExpress?: boolean;
  trabajoExpress?: TrabajoExpress | null;
  resumenTrabajo?: string | null;
  materiales?: LineaUsoOt[] | null;
}): string[] {
  if (!input.esInstalacion && !input.esExpress) return [];

  const lineas = input.materiales ?? [];
  const erroresLineas = lineas.flatMap((linea, i) =>
    erroresLineaUso(linea).map((e) => `Elemento ${i + 1}: ${e}`)
  );

  if (input.esInstalacion) {
    if (lineas.length === 0) {
      return [ERROR_INSTALACION_SIN_USO, ...erroresLineas];
    }
    return erroresLineas;
  }

  if (!input.esExpress) return erroresLineas;

  const regimen = regimenExpress(input.trabajoExpress);
  const hayEquipo = lineas.some((l) => esLineaEquipo(l) && erroresLineaUso(l).length === 0);
  const hayMaterial = lineas.some((l) => !esLineaEquipo(l) && erroresLineaUso(l).length === 0);

  if (regimen === "EQUIPO" && !hayEquipo) {
    return [
      "Debe registrar el equipo utilizado (marca, modelo, serie y cantidad).",
      ...erroresLineas,
    ];
  }
  if (regimen === "MATERIAL" && !hayMaterial) {
    return [
      "Debe registrar el material utilizado (elemento, tipo, cantidad y unidad).",
      ...erroresLineas,
    ];
  }
  if (regimen === "OPCIONAL" && lineas.length === 0) {
    if (!declaraSinUso(input.resumenTrabajo) || !observacionSinUsoValida(input.resumenTrabajo)) {
      return [
        "Indique SIN EQUIPOS NI MATERIALES UTILIZADOS y explique el motivo, o registre lo utilizado.",
      ];
    }
  }
  return erroresLineas;
}
