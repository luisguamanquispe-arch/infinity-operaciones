export const TIPO_NUEVA_INSTALACION = "NUEVA_INSTALACION" as const;

export const MAX_LONGITUD_NUMERO_CONTRATO = 80;

export type CategoriaMaterialInstalacion = "MATERIAL" | "EQUIPO";

export interface CatalogoMaterialInstalacionItem {
  id: string;
  label: string;
  categoria: CategoriaMaterialInstalacion;
  unidadDefault: string;
}

export const MATERIALES_CONSUMIBLES_INSTALACION: readonly CatalogoMaterialInstalacionItem[] = [
  { id: "FIBRA_OPTICA", label: "Fibra óptica", categoria: "MATERIAL", unidadDefault: "metros" },
  { id: "ROSETA_OPTICA", label: "Roseta óptica", categoria: "MATERIAL", unidadDefault: "unidades" },
  { id: "PATCH_CORD", label: "Patch cord", categoria: "MATERIAL", unidadDefault: "unidades" },
  { id: "PIGTELES", label: "Pigteles", categoria: "MATERIAL", unidadDefault: "unidades" },
  { id: "ADAPTADORES", label: "Adaptadores", categoria: "MATERIAL", unidadDefault: "unidades" },
  { id: "CONECTORES", label: "Conectores", categoria: "MATERIAL", unidadDefault: "unidades" },
  {
    id: "GRAPAS_ACCESORIOS",
    label: "Grapas y accesorios",
    categoria: "MATERIAL",
    unidadDefault: "unidades",
  },
  {
    id: "OTROS_MATERIALES",
    label: "Otros materiales utilizados",
    categoria: "MATERIAL",
    unidadDefault: "unidades",
  },
] as const;

export const EQUIPOS_INSTALACION: readonly CatalogoMaterialInstalacionItem[] = [
  { id: "ROUTER", label: "Router", categoria: "EQUIPO", unidadDefault: "unidades" },
  { id: "BRIDGE", label: "Bridge", categoria: "EQUIPO", unidadDefault: "unidades" },
  { id: "ONU_ONT", label: "ONU/ONT", categoria: "EQUIPO", unidadDefault: "unidades" },
  {
    id: "OTROS_EQUIPOS",
    label: "Otros equipos utilizados",
    categoria: "EQUIPO",
    unidadDefault: "unidades",
  },
] as const;

export const CATALOGO_MATERIALES_INSTALACION: readonly CatalogoMaterialInstalacionItem[] = [
  ...MATERIALES_CONSUMIBLES_INSTALACION,
  ...EQUIPOS_INSTALACION,
];

export const UNIDADES_MATERIAL_INSTALACION = [
  "unidades",
  "metros",
  "rollos",
  "cajas",
  "kits",
] as const;

export interface MaterialInstalacionInput {
  categoria?: string;
  item?: string;
  cantidad?: number | string;
  unidad?: string;
  marca?: string | null;
  series?: string[] | null;
}

export interface MaterialInstalacionNormalizado {
  categoria: CategoriaMaterialInstalacion;
  item: string;
  cantidad: number;
  unidad: string;
  marca: string | null;
  series: string[];
}

/**
 * Normaliza el número de contrato a instalar eliminando espacios al inicio y al final.
 * Devuelve null si queda vacío.
 */
export function normalizarNumeroContratoInstalar(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().slice(0, MAX_LONGITUD_NUMERO_CONTRATO);
  return limpio.length > 0 ? limpio : null;
}

export type ValidacionContratoResult =
  | { ok: true; numeroContratoInstalar: string | null }
  | { ok: false; error: string };

/**
 * Valida el campo obligatorio "Número de contrato a instalar" exclusivamente cuando
 * el tipo de trabajo es NUEVA_INSTALACION. Para otros tipos no exige contrato.
 */
export function validarNumeroContratoInstalar(
  tipo: string | null | undefined,
  valor: unknown
): ValidacionContratoResult {
  if (tipo !== TIPO_NUEVA_INSTALACION) {
    return { ok: true, numeroContratoInstalar: null };
  }
  const normalizado = normalizarNumeroContratoInstalar(valor);
  if (!normalizado) {
    return {
      ok: false,
      error: "Debe ingresar el número de contrato a instalar.",
    };
  }
  return { ok: true, numeroContratoInstalar: normalizado };
}

export type ValidacionMaterialesResult =
  | { ok: true; items: MaterialInstalacionNormalizado[] }
  | { ok: false; error: string };

/**
 * Valida y normaliza la lista de materiales y equipos utilizados en una Nueva instalación.
 * - Exige al menos 1 registro válido.
 * - Cantidad obligatoria > 0 (y entera para equipos).
 * - Equipos exigen marca y series individuales (cantidad === series.length).
 * - Materiales consumibles no exigen marca ni serie.
 */
export function validarMaterialesInstalacion(raw: unknown): ValidacionMaterialesResult {
  if (!Array.isArray(raw) || raw.length === 0) {
    return {
      ok: false,
      error: "Debe registrar al menos un material o equipo utilizado en la instalación.",
    };
  }

  const normalizados: MaterialInstalacionNormalizado[] = [];

  for (let i = 0; i < raw.length; i++) {
    const fila = raw[i] as MaterialInstalacionInput | null | undefined;
    const num = i + 1;
    if (!fila || typeof fila !== "object") {
      return { ok: false, error: `Registro #${num}: datos inválidos.` };
    }

    const item = typeof fila.item === "string" ? fila.item.trim().slice(0, 120) : "";
    if (!item) {
      return { ok: false, error: `Registro #${num}: debe indicar el material o equipo.` };
    }

    const catCatalogo = CATALOGO_MATERIALES_INSTALACION.find(
      (c) => c.label.toLowerCase() === item.toLowerCase()
    )?.categoria;
    const categoria: CategoriaMaterialInstalacion =
      fila.categoria === "EQUIPO" || fila.categoria === "MATERIAL"
        ? fila.categoria
        : (catCatalogo ?? "MATERIAL");

    const cantidadNum =
      typeof fila.cantidad === "number"
        ? fila.cantidad
        : typeof fila.cantidad === "string" && fila.cantidad.trim() !== ""
          ? Number(fila.cantidad)
          : NaN;

    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      return {
        ok: false,
        error: `Registro #${num} (${item}): la cantidad utilizada debe ser mayor que cero.`,
      };
    }

    const unidad = typeof fila.unidad === "string" ? fila.unidad.trim().slice(0, 40) : "";
    if (!unidad) {
      return {
        ok: false,
        error: `Registro #${num} (${item}): debe indicar la unidad de medida.`,
      };
    }

    if (categoria === "EQUIPO") {
      if (!Number.isInteger(cantidadNum)) {
        return {
          ok: false,
          error: `Registro #${num} (${item}): la cantidad de equipos debe ser un número entero.`,
        };
      }
      const marca = typeof fila.marca === "string" ? fila.marca.trim().slice(0, 80) : "";
      if (!marca) {
        return {
          ok: false,
          error: `Registro #${num} (${item}): debe ingresar la marca del equipo.`,
        };
      }
      const seriesRaw = Array.isArray(fila.series) ? fila.series : [];
      const seriesLimpias = seriesRaw
        .map((s) => (typeof s === "string" ? s.trim().slice(0, 100) : ""))
        .filter((s) => s.length > 0);

      if (seriesLimpias.length !== cantidadNum) {
        return {
          ok: false,
          error: `Registro #${num} (${item}): debe registrar ${cantidadNum} número(s) de serie (uno por cada equipo).`,
        };
      }
      const unicas = new Set(seriesLimpias.map((s) => s.toUpperCase()));
      if (unicas.size !== seriesLimpias.length) {
        return {
          ok: false,
          error: `Registro #${num} (${item}): los números de serie no pueden estar repetidos.`,
        };
      }

      normalizados.push({
        categoria,
        item,
        cantidad: cantidadNum,
        unidad,
        marca,
        series: seriesLimpias,
      });
    } else {
      normalizados.push({
        categoria,
        item,
        cantidad: cantidadNum,
        unidad,
        marca: null,
        series: [],
      });
    }
  }

  return { ok: true, items: normalizados };
}

/**
 * Validación integral antes de finalizar/enviar el informe técnico de una Nueva instalación.
 * Para cualquier otro tipo de trabajo devuelve { ok: true } sin exigir estos campos.
 */
export function validarFinalizacionNuevaInstalacion(params: {
  tipo: string | null | undefined;
  numeroContratoInstalar: unknown;
  materialesInstalacion: unknown;
}): { ok: true } | { ok: false; error: string } {
  if (params.tipo !== TIPO_NUEVA_INSTALACION) {
    return { ok: true };
  }
  const contratoVal = validarNumeroContratoInstalar(params.tipo, params.numeroContratoInstalar);
  if (!contratoVal.ok) {
    return { ok: false, error: contratoVal.error };
  }
  const matVal = validarMaterialesInstalacion(params.materialesInstalacion);
  if (!matVal.ok) {
    return { ok: false, error: matVal.error };
  }
  return { ok: true };
}
