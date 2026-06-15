import type { TipoInventario, TipoPatchCord } from "@prisma/client";
import { materialRequiereDetalle, tipoInventarioEfectivo } from "./material-detalle";

export interface MaterialReporteDTO {
  id: string;
  cantidad: number;
  serie: string | null;
  modelo: string | null;
  marca: string | null;
  tipoPatchCord: TipoPatchCord | string | null;
  excedenteMetros: number | null;
  inventario: {
    nombre: string;
    unidad: string;
    tipo: TipoInventario;
  };
}

type MaterialDb = {
  id: string;
  cantidad: number;
  serie: string | null;
  modelo: string | null;
  marca: string | null;
  tipoPatchCord: TipoPatchCord | null;
  excedenteMetros: number | null;
  inventario: {
    nombre: string;
    unidad: string;
    tipo: TipoInventario;
  };
};

function prioridadMaterial(m: MaterialReporteDTO): number {
  const tipo = tipoInventarioEfectivo(m.inventario.tipo, m.inventario.nombre);
  if (tipo === "EQUIPO") return 0;
  if (materialRequiereDetalle(tipo, m.inventario.nombre)) return 1;
  return 2;
}

export function ordenarMaterialesReporte(materiales: MaterialReporteDTO[]): MaterialReporteDTO[] {
  return [...materiales].sort(
    (a, b) =>
      prioridadMaterial(a) - prioridadMaterial(b) ||
      a.inventario.nombre.localeCompare(b.inventario.nombre, "es")
  );
}

/** Normaliza materiales para el reporte (API + UI). */
export function materialesParaReporte(materiales: MaterialDb[]): MaterialReporteDTO[] {
  return ordenarMaterialesReporte(
    materiales.map((m) => ({
      id: m.id,
      cantidad: m.cantidad,
      serie: m.serie,
      modelo: m.modelo,
      marca: m.marca,
      tipoPatchCord: m.tipoPatchCord,
      excedenteMetros: m.excedenteMetros,
      inventario: {
        nombre: m.inventario?.nombre ?? "Material",
        unidad: m.inventario?.unidad ?? "unidad",
        tipo: m.inventario?.tipo ?? "CONSUMIBLE",
      },
    }))
  );
}
