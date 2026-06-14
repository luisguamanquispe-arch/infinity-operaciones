import type { TipoInventario, TipoPatchCord } from "@prisma/client";

export const TIPO_PATCHCORD_LABELS: Record<TipoPatchCord, string> = {
  APC_APC: "APC-APC",
  APC_UPC: "APC-UPC",
  UPC_UPC: "UPC-UPC",
};

export const TIPOS_PATCHCORD = Object.keys(TIPO_PATCHCORD_LABELS) as TipoPatchCord[];

export function materialRequiereDetalle(tipo: TipoInventario): boolean {
  return tipo === "PATCHCORD" || tipo === "EQUIPO";
}

export function materialEsPatchcord(tipo: TipoInventario): boolean {
  return tipo === "PATCHCORD";
}

/** Resuelve tipo cuando el inventario aún no tiene categoría explícita. */
export function inferTipoInventario(nombre: string): TipoInventario {
  const n = nombre.toLowerCase();
  if (n.includes("patch")) return "PATCHCORD";
  if (
    n.includes("onu") ||
    n.includes("router") ||
    n.includes("route") ||
    n.includes("bridge") ||
    n.includes("repetidor")
  ) {
    return "EQUIPO";
  }
  return "CONSUMIBLE";
}

export function tipoInventarioEfectivo(
  tipo: TipoInventario | undefined,
  nombre: string
): TipoInventario {
  if (tipo && tipo !== "CONSUMIBLE") return tipo;
  return inferTipoInventario(nombre);
}

export interface MaterialDetalleInput {
  inventarioId: string;
  cantidad: string | number;
  serie?: string;
  modelo?: string;
  marca?: string;
  tipoPatchCord?: TipoPatchCord | string | null;
}

export function validarMaterialDetalle(
  tipo: TipoInventario,
  material: MaterialDetalleInput
): string | null {
  if (!materialRequiereDetalle(tipo)) return null;

  const serie = material.serie?.trim();
  const modelo = material.modelo?.trim();
  const marca = material.marca?.trim();

  if (!serie) return "Indique la serie del material";
  if (!modelo) return "Indique el modelo del material";
  if (!marca) return "Indique la marca del material";

  if (materialEsPatchcord(tipo)) {
    if (!material.tipoPatchCord || !TIPOS_PATCHCORD.includes(material.tipoPatchCord as TipoPatchCord)) {
      return "Seleccione el tipo de patch cord (APC-APC, APC-UPC o UPC-UPC)";
    }
  }

  return null;
}
