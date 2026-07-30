import type { TipoInventario, TipoPatchCord } from "@prisma/client";

export const TIPO_PATCHCORD_LABELS: Record<TipoPatchCord, string> = {
  APC_APC: "APC-APC",
  APC_UPC: "APC-UPC",
  UPC_UPC: "UPC-UPC",
};

export const TIPOS_PATCHCORD = Object.keys(TIPO_PATCHCORD_LABELS) as TipoPatchCord[];

function nombreNorm(nombre: string): string {
  return nombre.toLowerCase();
}

export function materialEsPigtail(nombre: string): boolean {
  return nombreNorm(nombre).includes("pigtail");
}

/** Cable drop / fibras (metros) — requieren lote, modelo y marca. */
export function materialEsCableOFibra(nombre: string): boolean {
  const n = nombreNorm(nombre);
  return (
    n.includes("cable drop") ||
    n.includes("cable droop") ||
    n.includes("fibra") ||
    (n.includes("drop") && (n.includes("cable") || n.includes("fibra")))
  );
}

/** Equipos activos (ONU, router, bridge, etc.). */
export function materialEsEquipoActivo(nombre: string): boolean {
  const n = nombreNorm(nombre);
  return (
    n.includes("onu") ||
    n.includes("router") ||
    n.includes("route") ||
    n.includes("bridge") ||
    n.includes("repetidor") ||
    n.includes("mikrotik") ||
    n === "rb mikrotik" ||
    n.startsWith("rb ")
  );
}

/** Equipos/passivos de infra que exigen serie, modelo y marca. */
export function materialInfraConDetalle(nombre: string): boolean {
  const n = nombreNorm(nombre);
  return (
    materialEsPigtail(nombre) ||
    materialEsEquipoActivo(nombre) ||
    materialEsCableOFibra(nombre) ||
    n.includes("caja nap") ||
    n.includes("splitter")
  );
}

export function materialRequiereDetalle(tipo: TipoInventario, nombre?: string): boolean {
  if (tipo === "PATCHCORD" || tipo === "EQUIPO") return true;
  if (nombre && materialInfraConDetalle(nombre)) return true;
  return false;
}

export function materialEsPatchcord(tipo: TipoInventario, nombre?: string): boolean {
  if (tipo !== "PATCHCORD") return false;
  if (nombre && materialEsPigtail(nombre)) return false;
  return true;
}

/** Resuelve tipo cuando el inventario aún no tiene categoría explícita. */
export function inferTipoInventario(nombre: string): TipoInventario {
  const n = nombreNorm(nombre);
  if (n.includes("patch") && !n.includes("pigtail")) return "PATCHCORD";
  if (materialEsEquipoActivo(nombre) || n.includes("caja nap") || n.includes("splitter")) {
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

/** Etiquetas de campos según material (app técnicos). */
export function etiquetasDetalleMaterial(nombre: string): {
  serie: string;
  modelo: string;
  marca: string;
  ayuda: string;
} {
  if (materialEsCableOFibra(nombre)) {
    return {
      serie: "Lote / bobina *",
      modelo: "Modelo / tipo *",
      marca: "Marca *",
      ayuda: "Cable y fibra: registre lote/bobina, modelo (ej. G657A) y marca.",
    };
  }
  if (materialEsEquipoActivo(nombre)) {
    return {
      serie: "Serie / SN *",
      modelo: "Modelo *",
      marca: "Marca *",
      ayuda: "ONU, router, bridge, etc.: serie, modelo y marca obligatorios.",
    };
  }
  return {
    serie: "Serie *",
    modelo: "Modelo *",
    marca: "Marca *",
    ayuda: "Indique serie, modelo y marca del material.",
  };
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
  material: MaterialDetalleInput,
  nombre?: string
): string | null {
  if (!materialRequiereDetalle(tipo, nombre)) return null;

  const serie = material.serie?.trim();
  const modelo = material.modelo?.trim();
  const marca = material.marca?.trim();
  const labels = etiquetasDetalleMaterial(nombre || "");

  if (!serie) {
    return materialEsCableOFibra(nombre || "")
      ? "Indique el lote/bobina del cable o fibra"
      : "Indique la serie del material";
  }
  if (!modelo) return `Indique el modelo (${labels.modelo.replace(" *", "")})`;
  if (!marca) return "Indique la marca del material";

  if (materialEsPatchcord(tipo, nombre)) {
    if (!material.tipoPatchCord || !TIPOS_PATCHCORD.includes(material.tipoPatchCord as TipoPatchCord)) {
      return "Seleccione el tipo de patch cord (APC-APC, APC-UPC o UPC-UPC)";
    }
  }

  return null;
}

export function guardarDetalleMaterial(
  tipo: TipoInventario,
  nombre: string,
  material: MaterialDetalleInput
): {
  serie: string | null;
  modelo: string | null;
  marca: string | null;
  tipoPatchCord: TipoPatchCord | null;
} {
  const requiere = materialRequiereDetalle(tipo, nombre);
  return {
    serie: requiere && material.serie?.trim() ? material.serie.trim().toUpperCase() : null,
    modelo: requiere && material.modelo?.trim() ? material.modelo.trim().toUpperCase() : null,
    marca: requiere && material.marca?.trim() ? material.marca.trim().toUpperCase() : null,
    tipoPatchCord:
      materialEsPatchcord(tipo, nombre) && material.tipoPatchCord
        ? (material.tipoPatchCord as TipoPatchCord)
        : null,
  };
}
